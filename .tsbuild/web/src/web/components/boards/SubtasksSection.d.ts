import { type SubtaskItem } from '../../lib/queries';
interface SubtasksSectionProps {
    cardId: string;
    boardId: string;
    subtasks: SubtaskItem[];
}
export declare function SubtasksSection({ cardId, boardId, subtasks }: SubtasksSectionProps): import("react").JSX.Element;
export {};
