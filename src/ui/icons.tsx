import { ReactElement } from "react";
import { twMerge } from "tailwind-merge";

import { assert } from "../assert";
import { pxNumbersAsRem } from "./utils/units";

function SvgIcon({
  title,
  className,
  size: _size,
  icon24,
  icon40,
}: {
  title: string;
  size?: number;
  className?: string;
  icon24?: ReactElement;
  icon40?: ReactElement;
} & ({ icon24: ReactElement } | { icon40: ReactElement })): JSX.Element {
  const size = _size ?? 40;
  const defaultIcon = icon24 ?? icon40;
  assert(defaultIcon);
  const icon = (size < 30 ? icon24 : icon40) ?? defaultIcon;
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={pxNumbersAsRem(size)}
    >
      <title>{title}</title>
      {icon}
    </svg>
  );
}

export function ExpandMoreIcon40(props: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Aexpand_more%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4040
    <SvgIcon
      title="Expand More"
      {...props}
      icon40={
        <path
          fill="currentColor"
          d="M480-345 240-585l47.333-47.333L480-438.999l192.667-192.667L720-584.333 480-345Z"
        />
      }
    />
  );
}

export function DoneIcon(props: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Atask_alt%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4040
    <SvgIcon
      title="Done"
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q65 0 123 19t107 53l-58 59q-38-24-81-37.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-18-2-36t-6-35l65-65q11 32 17 66t6 70q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-56-216L254-466l56-56 114 114 400-401 56 56-456 457Z"
        />
      }
      icon40={
        <path
          fill="currentColor"
          d="M480-80q-84.333 0-157.333-30.833-73-30.834-127-84.834t-84.834-127Q80-395.667 80-480q0-83.667 30.833-156.667 30.834-73 84.834-127t127-85.166Q395.667-880 480-880q71.667 0 134.334 22.333Q677-835.333 728.001-796l-48 48.333q-42-31.333-92.334-48.5Q537.334-813.334 480-813.334q-141 0-237.167 96.167T146.666-480q0 141 96.167 237.167T480-146.666q141 0 237.167-96.167T813.334-480q0-26-3.667-51-3.667-25.001-11-48.668L851-632q14.333 35.333 21.667 73.333Q880-520.667 880-480q0 84.333-31.167 157.333-31.166 73-85.166 127t-127 84.834Q563.667-80 480-80Zm-58-217.333L255.333-464.667 304-513.333l118 118L831.334-805l49.333 48.667-458.667 459Z"
        />
      }
    />
  );
}

export function ErrorIcon(props: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Aerror%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4040
    <SvgIcon
      title="Error"
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
        />
      }
      icon40={
        <path
          fill="currentColor"
          d="M479.988-280q15.012 0 25.179-10.155 10.166-10.155 10.166-25.167 0-15.011-10.155-25.178-10.155-10.166-25.166-10.166-15.012 0-25.179 10.155-10.166 10.154-10.166 25.166t10.155 25.178Q464.977-280 479.988-280Zm-31.321-155.333h66.666V-684h-66.666v248.667ZM480.177-80q-82.822 0-155.666-31.5t-127.178-85.833Q143-251.667 111.5-324.56 80-397.454 80-480.333q0-82.88 31.5-155.773Q143-709 197.333-763q54.334-54 127.227-85.5Q397.454-880 480.333-880q82.88 0 155.773 31.5Q709-817 763-763t85.5 127Q880-563 880-480.177q0 82.822-31.5 155.666T763-197.456q-54 54.21-127 85.833Q563-80 480.177-80Zm.156-66.666q139 0 236.001-97.334 97-97.333 97-236.333t-96.875-236.001q-96.876-97-236.459-97-138.667 0-236 96.875Q146.666-619.583 146.666-480q0 138.667 97.334 236 97.333 97.334 236.333 97.334ZM480-480Z"
        />
      }
    ></SvgIcon>
  );
}

export function PendingIcon(props: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Apending%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4040
    <SvgIcon
      title="Pending"
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M280-420q25 0 42.5-17.5T340-480q0-25-17.5-42.5T280-540q-25 0-42.5 17.5T220-480q0 25 17.5 42.5T280-420Zm200 0q25 0 42.5-17.5T540-480q0-25-17.5-42.5T480-540q-25 0-42.5 17.5T420-480q0 25 17.5 42.5T480-420Zm200 0q25 0 42.5-17.5T740-480q0-25-17.5-42.5T680-540q-25 0-42.5 17.5T620-480q0 25 17.5 42.5T680-420ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
        />
      }
      icon40={
        <path
          fill="currentColor"
          d="M270.745-426.667q22.255 0 37.755-15.578 15.5-15.579 15.5-37.833 0-22.255-15.579-37.755-15.578-15.5-37.833-15.5t-37.755 15.578q-15.5 15.579-15.5 37.833 0 22.255 15.579 37.755 15.578 15.5 37.833 15.5Zm209.333 0q22.255 0 37.755-15.578 15.5-15.579 15.5-37.833 0-22.255-15.578-37.755-15.579-15.5-37.833-15.5-22.255 0-37.755 15.578-15.5 15.579-15.5 37.833 0 22.255 15.578 37.755 15.579 15.5 37.833 15.5Zm208.667 0q22.255 0 37.755-15.578 15.5-15.579 15.5-37.833 0-22.255-15.578-37.755-15.579-15.5-37.833-15.5-22.255 0-37.755 15.578-15.5 15.579-15.5 37.833 0 22.255 15.578 37.755 15.579 15.5 37.833 15.5ZM480.177-80q-82.822 0-155.666-31.5t-127.178-85.833Q143-251.667 111.5-324.56 80-397.454 80-480.333q0-82.88 31.5-155.773Q143-709 197.333-763q54.334-54 127.227-85.5Q397.454-880 480.333-880q82.88 0 155.773 31.5Q709-817 763-763t85.5 127Q880-563 880-480.177q0 82.822-31.5 155.666T763-197.456q-54 54.21-127 85.833Q563-80 480.177-80Zm.156-66.666q139 0 236.001-97.334 97-97.333 97-236.333t-96.875-236.001q-96.876-97-236.459-97-138.667 0-236 96.875Q146.666-619.583 146.666-480q0 138.667 97.334 236 97.333 97.334 236.333 97.334ZM480-480Z"
        />
      }
    />
  );
}

export function CheckboxSelected(props: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Aselect_check_box%3AFILL%400%3Bwght%40400%3BGRAD%40-25%3Bopsz%4024
    <SvgIcon
      title="Selected Checkbox"
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M204-129q-30.938 0-52.969-22.031Q129-173.062 129-204v-552q0-30.938 22.031-52.969Q173.062-831 204-831h552q10 0 20 3.25t16.5 8.25L729-756H204v552h552v-276l75-75v351q0 30.938-22.031 52.969Q786.938-129 756-129H204Zm257-154.5L238.5-506l52.5-52.5 170.158 170L828.5-756l53 52L461-283.5Z"
        />
      }
    />
  );
}

export function CheckboxUnselected(props: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Acheck_box_outline_blank%3AFILL%400%3Bwght%40400%3BGRAD%40-25%3Bopsz%4024
    <SvgIcon
      title="Unselected Checkbox"
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M204-129q-30.938 0-52.969-22.031Q129-173.062 129-204v-552q0-30.938 22.031-52.969Q173.062-831 204-831h552q30.938 0 52.969 22.031Q831-786.938 831-756v552q0 30.938-22.031 52.969Q786.938-129 756-129H204Zm0-75h552v-552H204v552Z"
        />
      }
    />
  );
}

export function SearchIcon(props: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Asearch%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4024
    <SvgIcon
      title="Search"
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"
        />
      }
    />
  );
}

export function BlockIcon(props: {
  title?: string;
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Ablock%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4024
    <SvgIcon
      title={props.title ?? "Block"}
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"
        />
      }
    />
  );
}

export function GitHubLogo({
  className,
  officialColours = false,
}: {
  className?: string;
  officialColours?: boolean;
}): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 98 96"
      className={twMerge(
        officialColours ? "dark:text-white text-[#24292f]" : undefined,
        className,
      )}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
        fill="currentColor"
      />
    </svg>
  );
}

export function VaultonomyExtensionIcon({
  className,
}: {
  className?: string;
}): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      <path
        d="M0 2H30V32H4.5C5.5 29.5 5.91542 28.2745 4.5 24.5C3.08458 20.7255 2 19 0 13V2Z"
        fill="#536979"
      />
      <mask
        id="mask0_153_1017"
        style={{ maskType: "alpha" }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="32"
        height="32"
      >
        <rect width="32" height="32" fill="#548FB9" />
      </mask>
      <g mask="url(#mask0_153_1017)">
        <g filter="url(#filter0_d_153_1017)">
          <path
            d="M2 4L8.86455 21.7962L7.44809 21L14 4H16L8 24L0 4H2Z"
            fill="#E1EAF2"
          />
          <path
            d="M8 32L15 14L22 32H20L14.4435 16.6719L15.6077 16.6476L10 32H8ZM11 26H19V28H10L11 26Z"
            fill="#E1EAF2"
          />
          <path
            d="M20 15.1651C20.0254 17.3288 20.7167 17.99 22 18C23.2833 18.01 23.993 17.2699 24 15.1651V12H26V15.1651C26.0176 19.0262 24 20 22 20C20 20 17.9738 18.8933 18 15.2412V4H20V15.1651Z"
            fill="#E1EAF2"
          />
          <path d="M24 4L26 4L26 8H28V10H24L24 4Z" fill="#E1EAF2" />
          <path d="M0 0L32 0V32H30V2H0V0Z" fill="#E1EAF2" />
        </g>
      </g>
      <path d="M31 1H32V32H31V1Z" fill="#D1D5D7" />
      <path d="M0 0H32V1H0V0Z" fill="#D1D5D7" />
      <defs>
        <filter
          id="filter0_d_153_1017"
          x="0"
          y="0"
          width="32"
          height="33"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="1" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.45 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_153_1017"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_153_1017"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
}
