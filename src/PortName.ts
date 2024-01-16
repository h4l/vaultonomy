import { randomDebugId } from "./randomDebugId";

export class PortName {
  constructor(
    readonly base: string,
    readonly tag?: string,
  ) {}

  matches(other: PortName | string): boolean {
    const base =
      typeof other === "string" ? PortName.parse(other).base : other.base;
    return base === this.base;
  }

  toString(): string {
    return this.tag ? `${this.base}/${this.tag}` : this.base;
  }

  withRandomTag(): PortName {
    return new PortName(this.base, randomDebugId());
  }

  static parse(name: string): PortName {
    const [base, tag] = name.split("/", 2);
    return new PortName(base, tag);
  }
}
