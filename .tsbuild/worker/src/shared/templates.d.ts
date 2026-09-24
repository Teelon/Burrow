/**
 * Document starter templates (Epic 3.1).
 *
 * Plain structural block definitions compatible with BlockNote's `PartialBlock`
 * shape (heading / paragraph / list items), intentionally dependency-free so
 * both web and worker can import this module.
 */
export interface TemplateBlock {
    id?: string;
    type?: string;
    props?: Record<string, unknown>;
    content?: unknown;
    children?: TemplateBlock[];
}
export interface StarterTemplate {
    id: string;
    name: string;
    icon: string;
    description: string;
    blocks: TemplateBlock[];
}
export declare const STARTER_TEMPLATES: StarterTemplate[];
export declare function getTemplateById(id: string): StarterTemplate | undefined;
