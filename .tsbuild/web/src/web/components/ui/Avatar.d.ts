import * as React from 'react';
export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
    name: string;
    src?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg';
}
export declare const Avatar: React.ForwardRefExoticComponent<AvatarProps & React.RefAttributes<HTMLDivElement>>;
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    max?: number;
}
export declare const AvatarGroup: React.FC<AvatarGroupProps & {
    children: React.ReactNode;
}>;
