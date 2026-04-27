'use client';

import * as React from 'react';
import { Stack as MuiStack, type StackProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { CSSProperties } from 'react';

type FlexExtras = {
  alignItems?: CSSProperties['alignItems'];
  justifyContent?: CSSProperties['justifyContent'];
  flexWrap?: CSSProperties['flexWrap'];
  rowGap?: number | string;
};

type FlexStackProps = Omit<StackProps, keyof FlexExtras> & FlexExtras;

export const Stack = React.forwardRef<HTMLDivElement, FlexStackProps>(
  function Stack({ alignItems, justifyContent, flexWrap, rowGap, sx, ...rest }, ref) {
    const extras = { alignItems, justifyContent, flexWrap, rowGap };
    const hasExtras = Object.values(extras).some((v) => v !== undefined);
    const merged: SxProps<Theme> | undefined = hasExtras
      ? Array.isArray(sx)
        ? [extras as SxProps<Theme>, ...sx]
        : sx
          ? [extras as SxProps<Theme>, sx as SxProps<Theme>]
          : (extras as SxProps<Theme>)
      : sx;
    return <MuiStack ref={ref} {...rest} sx={merged} />;
  }
);

export default Stack;
