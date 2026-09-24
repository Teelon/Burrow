import * as React from 'react';
export interface StatusDiamondProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** Any CSS color (typically a Basalt token var). */
    color?: string;
    size?: number;
}
/** Rotated-square status marker. Visual footprint is small; wrapper keeps layout. */
export declare const StatusDiamond: React.FC<StatusDiamondProps>;
