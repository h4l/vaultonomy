import { ReactElement } from "react";

import { assert } from "../assert";

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
      width={size}
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
