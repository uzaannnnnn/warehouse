import { AnimatePresence, motion as Motion } from "framer-motion";
import { Dialog } from "@headlessui/react";

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  title,
  confirmLabel,
  verb,
}) {
  const resolvedTitle = title || "Konfirmasi Hapus";
  const resolvedVerb = verb || "menghapus";
  const resolvedConfirm = confirmLabel || "Hapus";

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          as="div"
          open
          onClose={onClose}
          className="relative z-50"
        >
          <Motion.div
            key="overlay"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            aria-hidden="true"
            onClick={onClose}
          />

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-xl"
            >
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {resolvedTitle}
              </Dialog.Title>
              <p className="text-sm text-gray-500">
                Apakah Anda yakin ingin {resolvedVerb}{" "}
                <strong>{itemName}</strong>?
              </p>

              <div className="mt-4 flex justify-end gap-3">
                <Motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="cursor-pointer rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
                  onClick={onClose}
                >
                  Kembali
                </Motion.button>
                <Motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="cursor-pointer rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                  onClick={onConfirm}
                >
                  {resolvedConfirm}
                </Motion.button>
              </div>
            </Motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
