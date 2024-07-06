import { FilterPattern, createFilter } from "@rollup/pluginutils";
import type { Node } from "estree";
import { walk } from "estree-walker";
import MagicString from "magic-string";
import { ProgramNode } from "rollup";
import { Plugin } from "vite";

type NodeLocation = { start: number; end: number };

/** Get the start, end location of a Node.
 *
 * Note: the estree Node type does not include start/end properties, but they're
 * present in practice.
 */
function getLocation(node: Node): NodeLocation {
  const location = node as Partial<NodeLocation>;
  if (typeof location.start === "number" && typeof location.end === "number") {
    return location as NodeLocation;
  }
  throw new Error(`Node is missing start/end: ${JSON.stringify(node)}`);
}

/**
 * A rollup plugin that replaces `Function("return this")()` calls.
 *
 * The lodash library (and probably other thing) use the Function constructor
 * in this way to get a reference to `globalThis` in a way that supports
 * runtimes without `globalThis`. This is problematic because Chrome Web Store
 * and Firefox Add-ons have policies that disallow use of `eval()` and the
 * function constructor.
 *
 * This plugin replaces `Function("return this")` occurrences with
 * `(() => globalThis)`.
 *
 * @param options.include if set, only transform these modules (default: include all)
 * @param options.exclude modules to exclude from transformation
 * @param options.sourceMap whether to generate source maps (default: `true`)
 * @returns
 */
export function transformFunctionConstructorReturnThis({
  sourceMap = true,
  include,
  exclude,
}: {
  include?: FilterPattern;
  exclude?: FilterPattern;
  sourceMap?: boolean;
} = {}): Plugin {
  const filter = createFilter(include, exclude);

  return {
    name: "transform-function-constructor-return-this",
    transform(code, id) {
      if (!filter(id)) return;
      this.debug("transformFunctionConstructorReturnThis: passed filter");
      // Bail out early if there are definitely no Function constructors
      if (code.search(/\bFunction\s*\(/) === -1) return;

      this.debug(
        "transformFunctionConstructorReturnThis: Function ctor may exist",
      );
      let ast: ProgramNode;
      try {
        ast = this.parse(code);
      } catch (err) {
        this.warn({
          code: "PARSE_ERROR",
          message: `transformFunctionConstructorReturnThis: failed to parse ${id}. Use options.include/options.exclude to ignore this file.`,
        });
        return;
      }

      const debug = this.debug.bind(this);
      const magicString = new MagicString(code);
      let replacementMade = false;

      walk(ast, {
        enter(node) {
          const location = getLocation(node);
          if (sourceMap) {
            magicString.addSourcemapLocation(location.start);
            magicString.addSourcemapLocation(location.end);
          }
          if (isFunctionConstructorReturnThis(node)) {
            debug(
              'transformFunctionConstructorReturnThis: replaced Function("return this") instance',
            );
            replacementMade = true;
            magicString.update(
              location.start,
              location.end,
              "(() => globalThis)",
            );
            this.skip();
          }
        },
      });

      if (!replacementMade) return;

      return {
        code: magicString.toString(),
        map: sourceMap ? magicString.generateMap({ hires: true }) : undefined,
      };
    },
  };
}

/**
 * Check if the node is a call to the Function constructor like:
 *
 * `Function("return this")`  or `new Function("return this")`
 */
function isFunctionConstructorReturnThis(node: Node): boolean {
  if (!(node.type === "CallExpression" || node.type === "NewExpression"))
    return false;

  return (
    node.callee.type === "Identifier" &&
    node.callee.name === "Function" &&
    node.arguments.length === 1 &&
    node.arguments[0].type === "Literal" &&
    typeof node.arguments[0].value === "string" &&
    isUnevaluatedReturnThis(node.arguments[0].value)
  );
}

/** @returns true if code is a code snippet like "return this" (ignoring whitespace). */
function isUnevaluatedReturnThis(code: string): boolean {
  // Could actually parse the code, but this is probably fine...
  return /^\s*return[ \t]+this[ \t]*(?:[\r\n;]|$)/.test(code);
}
