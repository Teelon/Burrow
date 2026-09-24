import type { BlockNoteEditor } from '@blocknote/core'
import { LayoutTemplate, X } from 'lucide-react'
import { STARTER_TEMPLATES, type StarterTemplate } from '../../shared/templates'

interface TemplatePickerModalProps {
  editor: BlockNoteEditor<any, any, any>
  onClose: () => void
}

/** Modal listing all starter templates; applying replaces the document. */
export function TemplatePickerModal({ editor, onClose }: TemplatePickerModalProps) {
  const apply = (template: StarterTemplate) => {
    editor.replaceBlocks(editor.document, template.blocks as any)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <LayoutTemplate className="w-4 h-4 text-primary" />
            <span>Start with a template</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template list */}
        <div className="p-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
          {STARTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => apply(template)}
              className="w-full flex items-start gap-3 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 text-left transition group"
            >
              <span className="text-xl leading-none mt-0.5 group-hover:scale-110 transition-transform">
                {template.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  {template.name}
                </span>
                <span className="block text-xs text-neutral-400 mt-0.5">
                  {template.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
