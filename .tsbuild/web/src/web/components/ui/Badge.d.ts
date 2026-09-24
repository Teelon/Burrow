import * as React from 'react';
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    tone?: 'neutral' | 'accent' | 'danger' | 'c1' | 'c2' | 'c3' | 'c4';
}
export declare const Badge: React.ForwardRefExoticComponent<BadgeProps & React.RefAttributes<HTMLSpanElement>>;
