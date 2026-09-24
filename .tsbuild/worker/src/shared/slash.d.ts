export type SlashContext = 'notepad' | 'card' | 'quickadd';
export type SlashActionType = 'block' | 'inline' | 'picker' | 'cardMeta';
export interface SlashCommand {
    id: string;
    label: string;
    aliases: string[];
    group: string;
    contexts: SlashContext[];
    action: SlashActionType;
}
