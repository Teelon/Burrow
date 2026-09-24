import * as React from 'react';
export interface SegmentOption {
    value: string;
    label: React.ReactNode;
}
export interface SegmentedControlProps {
    value: string;
    onValueChange: (value: string) => void;
    options: SegmentOption[];
    size?: 'sm' | 'md';
    fullWidth?: boolean;
    className?: string;
    ariaLabel?: string;
}
/** Angular segmented control — selected tab gets sulfur-yellow accent. */
export declare function SegmentedControl({ value, onValueChange, options, size, fullWidth, className, ariaLabel, }: SegmentedControlProps): React.JSX.Element;
