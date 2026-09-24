import type { BlockNoteEditor } from '@blocknote/core'
import { STARTER_TEMPLATES, type StarterTemplate } from '../../shared/templates'
import { ModalShell } from '../components/ui/ModalShell'

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
    <ModalShell open onClose={onClose} title="Start with a template">
        {/* Template list */}
        <div className="mt-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
          {STARTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => apply(template)}
              className="w-full flex items-start gap-3 p-3 min-h-[44px] border border-[var(--line)] bg-[var(--surface2)] hover:border-[var(--accent)] hover:bg-[var(--hi)] text-left transition group"
            >
              <span className="text-xl leading-none mt-0.5">
                {template.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-[var(--text)]">
                  {template.name}
                </span>
                <span className="block text-xs text-[var(--muted)] mt-0.5">
                  {template.description}
                </span>
              </span>
            </button>
          ))}
        </div>
    </ModalShell>
  )
}
