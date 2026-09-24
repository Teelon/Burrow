export type SlashContext = 'notepad' | 'card' | 'quickadd';
export type SlashActionType = 'basic' | 'list' | 'structure' | 'image' | 'notepad' | 'task' | 'board' | 'due' | 'priority' | 'assign' | 'tag' | 'move' | 'date' | 'mention';
export interface SlashCommand {
    id: string;
    label: string;
    aliases: string[];
    group: 'Basic' | 'Lists' | 'Structural' | 'Links & References' | 'Task & Metadata';
    contexts: SlashContext[];
    action: SlashActionType;
    icon?: string;
}
export declare const SLASH_COMMANDS: SlashCommand[];
export declare function getSlashCommandsForContext(context: SlashContext, query?: string): SlashCommand[];
