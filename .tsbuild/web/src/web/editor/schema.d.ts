import { BlockNoteSchema } from '@blocknote/core';
/**
 * Custom inline mention content spec — Basalt angular chips on token surfaces.
 */
export declare const Mention: import("@blocknote/core").InlineContentSpec<{
    readonly type: "mention";
    readonly propSchema: {
        readonly kind: {
            readonly default: "user";
            readonly values: readonly ["user", "notepad", "card", "date"];
        };
        readonly id: {
            readonly default: "";
        };
        readonly label: {
            readonly default: "";
        };
        readonly isoDate: {
            readonly default: "";
        };
    };
    readonly content: "none";
}>;
/**
 * Custom block for notepadLink.
 */
export declare const NotepadLinkBlock: (options?: undefined) => import("@blocknote/core").BlockSpec<"notepadLink", {
    readonly notepadId: {
        readonly default: "";
    };
}, "none">;
/**
 * Custom block for cardLink.
 */
export declare const CardLinkBlock: (options?: undefined) => import("@blocknote/core").BlockSpec<"cardLink", {
    readonly cardId: {
        readonly default: "";
    };
}, "none">;
/**
 * Burrow BlockNote schema combining default blocks with custom mentions and link blocks.
 */
export declare const schema: BlockNoteSchema<import("@blocknote/core").BlockSchemaFromSpecs<{
    notepadLink: import("@blocknote/core").BlockSpec<"notepadLink", {
        readonly notepadId: {
            readonly default: "";
        };
    }, "none">;
    cardLink: import("@blocknote/core").BlockSpec<"cardLink", {
        readonly cardId: {
            readonly default: "";
        };
    }, "none">;
    audio: import("@blocknote/core").BlockSpec<"audio", {
        readonly backgroundColor: {
            default: "default";
        };
        readonly name: {
            readonly default: "";
        };
        readonly url: {
            readonly default: "";
        };
        readonly caption: {
            readonly default: "";
        };
        readonly showPreview: {
            readonly default: true;
        };
    }, "none">;
    bulletListItem: import("@blocknote/core").BlockSpec<"bulletListItem", {
        readonly backgroundColor: {
            default: "default";
        };
        readonly textColor: {
            default: "default";
        };
        readonly textAlignment: {
            default: "left";
            values: readonly ["left", "center", "right", "justify"];
        };
    }, "inline">;
    checkListItem: import("@blocknote/core").BlockSpec<"checkListItem", {
        readonly backgroundColor: {
            default: "default";
        };
        readonly textColor: {
            default: "default";
        };
        readonly textAlignment: {
            default: "left";
            values: readonly ["left", "center", "right", "justify"];
        };
        readonly checked: {
            readonly default: false;
            readonly type: "boolean";
        };
    }, "inline">;
    codeBlock: import("@blocknote/core").BlockSpec<"codeBlock", {
        readonly language: {
            readonly default: string;
        };
    }, "plain">;
    divider: import("@blocknote/core").BlockSpec<"divider", {}, "none">;
    file: import("@blocknote/core").BlockSpec<"file", {
        readonly backgroundColor: {
            default: "default";
        };
        readonly name: {
            readonly default: "";
        };
        readonly url: {
            readonly default: "";
        };
        readonly caption: {
            readonly default: "";
        };
    }, "none">;
    heading: import("@blocknote/core").BlockSpec<"heading", {
        readonly backgroundColor: {
            default: "default";
        };
        readonly textColor: {
            default: "default";
        };
        readonly textAlignment: {
            default: "left";
            values: readonly ["left", "center", "right", "justify"];
        };
        readonly level: {
            readonly default: 1 | 2 | 3 | 4 | 5 | 6;
            readonly values: readonly number[];
        };
        readonly isToggleable?: {
            readonly default: false;
            readonly optional: true;
        } | undefined;
    }, "inline">;
    image: import("@blocknote/core").BlockSpec<"image", {
        readonly textAlignment: {
            default: "left";
            values: readonly ["left", "center", "right", "justify"];
        };
        readonly backgroundColor: {
            default: "default";
        };
        readonly name: {
            readonly default: "";
        };
        readonly url: {
            readonly default: "";
        };
        readonly caption: {
            readonly default: "";
        };
        readonly showPreview: {
            readonly default: true;
        };
        readonly previewWidth: {
            readonly default: undefined;
            readonly type: "number";
        };
    }, "none">;
    numberedListItem: import("@blocknote/core").BlockSpec<"numberedListItem", {
        readonly backgroundColor: {
            default: "default";
        };
        readonly textColor: {
            default: "default";
        };
        readonly textAlignment: {
            default: "left";
            values: readonly ["left", "center", "right", "justify"];
        };
        readonly start: {
            readonly default: undefined;
            readonly type: "number";
        };
    }, "inline">;
    paragraph: import("@blocknote/core").BlockSpec<"paragraph", {
        backgroundColor: {
            default: "default";
        };
        textColor: {
            default: "default";
        };
        textAlignment: {
            default: "left";
            values: readonly ["left", "center", "right", "justify"];
        };
    }, "inline">;
    quote: import("@blocknote/core").BlockSpec<"quote", {
        readonly backgroundColor: {
            default: "default";
        };
        readonly textColor: {
            default: "default";
        };
    }, "inline">;
    table: import("@blocknote/core").LooseBlockSpec<"table", {
        textColor: {
            default: "default";
        };
    }, "table">;
    toggleListItem: import("@blocknote/core").BlockSpec<"toggleListItem", {
        readonly backgroundColor: {
            default: "default";
        };
        readonly textColor: {
            default: "default";
        };
        readonly textAlignment: {
            default: "left";
            values: readonly ["left", "center", "right", "justify"];
        };
    }, "inline">;
    video: import("@blocknote/core").BlockSpec<"video", {
        textAlignment: {
            default: "left";
            values: readonly ["left", "center", "right", "justify"];
        };
        backgroundColor: {
            default: "default";
        };
        name: {
            default: "";
        };
        url: {
            default: "";
        };
        caption: {
            default: "";
        };
        showPreview: {
            default: boolean;
        };
        previewWidth: {
            default: undefined;
            type: "number";
        };
    }, "none">;
}>, import("@blocknote/core").InlineContentSchemaFromSpecs<{
    mention: import("@blocknote/core").InlineContentSpec<{
        readonly type: "mention";
        readonly propSchema: {
            readonly kind: {
                readonly default: "user";
                readonly values: readonly ["user", "notepad", "card", "date"];
            };
            readonly id: {
                readonly default: "";
            };
            readonly label: {
                readonly default: "";
            };
            readonly isoDate: {
                readonly default: "";
            };
        };
        readonly content: "none";
    }>;
    text: {
        config: "text";
        implementation: any;
    };
    link: {
        config: "link";
        implementation: any;
    };
}>, import("@blocknote/core").StyleSchemaFromSpecs<{
    bold: {
        config: {
            type: string;
            propSchema: "boolean";
        };
        implementation: import("@blocknote/core").StyleImplementation<{
            type: string;
            propSchema: "boolean";
        }>;
    };
    italic: {
        config: {
            type: string;
            propSchema: "boolean";
        };
        implementation: import("@blocknote/core").StyleImplementation<{
            type: string;
            propSchema: "boolean";
        }>;
    };
    underline: {
        config: {
            type: string;
            propSchema: "boolean";
        };
        implementation: import("@blocknote/core").StyleImplementation<{
            type: string;
            propSchema: "boolean";
        }>;
    };
    strike: {
        config: {
            type: string;
            propSchema: "boolean";
        };
        implementation: import("@blocknote/core").StyleImplementation<{
            type: string;
            propSchema: "boolean";
        }>;
    };
    code: {
        config: {
            type: string;
            propSchema: "boolean";
        };
        implementation: import("@blocknote/core").StyleImplementation<{
            type: string;
            propSchema: "boolean";
        }>;
    };
    textColor: import("@blocknote/core").StyleSpec<{
        readonly type: "textColor";
        readonly propSchema: "string";
    }>;
    backgroundColor: import("@blocknote/core").StyleSpec<{
        readonly type: "backgroundColor";
        readonly propSchema: "string";
    }>;
}>>;
export type BurrowSchema = typeof schema;
