"use client";

type TerminateModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (deleteWorkspace: boolean) => void;
};

export default function TerminateModal({ open, onClose, onConfirm }: TerminateModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Terminate Instance</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Do you want to keep this workspace volume so it can be reused later, or delete it permanently?
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={() => {
              onConfirm(false); // keep workspace
              onClose();
            }}
            className="flex-1 text-center border border-yellow-500/50 text-yellow-600 px-4 py-2 rounded-lg hover:bg-yellow-500/10 transition-colors"
          >
            Terminate & Keep Workspace
          </button>

          <button
            onClick={() => {
              onConfirm(true); // delete workspace
              onClose();
            }}
            className="flex-1 text-center border border-red-500/50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Terminate & Delete Workspace
          </button>

          <button
            onClick={onClose}
            className="flex-1 text-center border border-border text-muted-foreground px-4 py-2 rounded-lg hover:bg-border hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
