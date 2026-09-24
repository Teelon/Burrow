import * as React from 'react';
export interface TreeItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
    depth?: number;
    diamondColor?: string;
}
/** Sidebar tree row — angular, 44px touch target, 4px accent bar when active. */
export declare const TreeItem: React.ForwardRefExoticComponent<TreeItemProps & React.RefAttributes<HTMLButtonElement>>;
