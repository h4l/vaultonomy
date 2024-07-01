import React, { useId } from "react";

import { useImageSize } from "./hooks/useImageSize";

const IMG_WIDTH = 380;
const IMG_BELOW = 103;
const MAX_IMG_HEIGHT = 600;
const MAX_AVATAR_HEIGHT = MAX_IMG_HEIGHT - IMG_BELOW;

export function UserAvatar({
  avatarUrl,
  className,
  title,
  fixedHeight = false,
}: {
  title?: string;
  avatarUrl?: string;
  className?: string;
  fixedHeight?: boolean;
}) {
  title = title || (avatarUrl ? "User Avatar" : "Placeholder Avatar");
  const id = useId();
  const avatarSize = useImageSize(avatarUrl);
  const imgHeight = avatarSize.loaded ? avatarSize.height : PLACEHOLDER_HEIGHT;
  const showPlaceholder: boolean = !avatarSize.loaded;

  // Avatar images are a fixed width, but variable height, depending on how
  // tall their headwear. Feet are at the same offset from the bottom. So we
  // position the image relative to the bottom, not the top.
  const viewHeight = imgHeight - IMG_BELOW;
  const imgY = 0;
  const circleRadius = 148;
  const circlePad = 5;
  const circleMidY = viewHeight - circlePad - circleRadius;
  const viewboxOriginY = fixedHeight ? viewHeight - MAX_AVATAR_HEIGHT : 0;
  const viewboxHeight = fixedHeight ? MAX_AVATAR_HEIGHT : viewHeight;
  const MaskLower = () => (
    <>
      <rect
        x={0}
        y={circleMidY}
        width={IMG_WIDTH}
        height={60}
        fill={`url(#grad-wb-v${id})`}
      />
    </>
  );

  const MaskUpper = () => {
    return (
      <>
        <mask id={`mask-outer-circle${id}`}>
          <circle
            cx={IMG_WIDTH / 2}
            cy={circleMidY}
            r={circleRadius + circlePad}
            fill="white"
          />
        </mask>
        <rect x={0} y={0} width={IMG_WIDTH} height={circleMidY} fill="white" />
        <rect
          x={0}
          y={circleMidY}
          width={IMG_WIDTH}
          height={5}
          fill={`url(#grad-wb-v${id})`}
          mask={`url(#mask-outer-circle${id})`}
        />
        <ellipse
          cx={IMG_WIDTH / 2}
          cy={circleMidY}
          rx={circleRadius + circlePad * 0.5}
          ry={circleRadius}
          fill="white"
        />
      </>
    );
  };

  return (
    <svg
      className={className}
      viewBox={`0 ${viewboxOriginY} ${IMG_WIDTH} ${viewboxHeight}`}
      width={IMG_WIDTH}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs aria-hidden="true">
        {avatarUrl ?
          <UserAvatarImage id={`img${id}`} url={avatarUrl} />
        : undefined}
        <PlaceholderAvatarImage id={`placeholder${id}`} />
        <linearGradient id={`grad-wb-v${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id={`mask-lower${id}`}>
          <MaskLower />
        </mask>
        <mask id={`mask-upper${id}`}>
          <MaskUpper />
        </mask>
      </defs>

      <use
        href={`#${showPlaceholder ? "placeholder" : "img"}${id}`}
        x="0"
        y={imgY}
        width={IMG_WIDTH}
        mask={`url(#mask-lower${id})`}
      />
      <circle
        cx={IMG_WIDTH / 2}
        cy={circleMidY}
        r={circleRadius + circlePad}
        fill="#D9D9D9"
      />
      <use
        aria-hidden="true"
        href={`#${showPlaceholder ? "placeholder" : "img"}${id}`}
        x="0"
        y={imgY}
        width={IMG_WIDTH}
        mask={`url(#mask-upper${id})`}
      />
    </svg>
  );
}

function UserAvatarImage({ id, url }: { id?: string; url: string }) {
  return (
    <>
      <image id={id} width={IMG_WIDTH} href={url} />
    </>
  );
}

const PLACEHOLDER_HEIGHT = 488;

function PlaceholderAvatarImage({ id }: { id?: string }) {
  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      width={IMG_WIDTH}
      height={PLACEHOLDER_HEIGHT}
      viewBox={`0 -1 ${IMG_WIDTH} ${PLACEHOLDER_HEIGHT}`}
    >
      <title>Placeholder Avatar</title>
      <path
        fill="#F5F5F5"
        stroke="#373737"
        strokeDasharray="4, 8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
        d="M282 337c-4 26-21 18-26 12 .1 14-9 40-15 57 11 13 13 24 3 34-6 6-23 8-36-2-10-9-14-15-14-31l-2-.2c-.8 4-.5 8-.7 11 7 10 12 32-7 40-22 8-43-15-42-36 .5-14 .6-32 3-41-.7-1-1-2-1-2-18 2-26-23-25-51 1-29 9-51 28-68-11-2-70-15-79-77a45 45 0 0 1 28-77c37-31 78-32 78-32-2-14-8-43-20-64-11 7-41 25-41 25 5 11 5 19-1 31-3 6-8 6-13 10-10 8-23 7-32 3-15-7-22-26-15-42s36-32 58-7c12-9 22-16 30-22 8-5 13-10 14-10 4 .2 10 13 14 22s12 32 14 42c.5 2-.4 4-.5 9 38-4 68 13 77 18 39-3 57 36 44 62 14 36 .4 80-49 101 21 24 32 58 29 83z"
      />
    </svg>
  );
}
