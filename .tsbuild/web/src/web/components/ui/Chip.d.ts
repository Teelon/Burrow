import * as React from 'react';
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
}
/** Angular filter chip — touch-friendly, horizontally scrollable on mobile. */
export declare const Chip: React.ForwardRefExoticComponent<ChipProps & React.RefAttributes<HTMLButtonElement>>;
