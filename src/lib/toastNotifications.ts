import { toast } from "sonner";

interface ToastOptions {
  description?: string;
  duration?: number;
}

export const notifySuccess = (title: string, options?: ToastOptions) => {
  toast.success(title, {
    description: options?.description,
    duration: options?.duration || 3000,
  });
};

export const notifyError = (title: string, options?: ToastOptions) => {
  toast.error(title, {
    description: options?.description,
    duration: options?.duration || 4000,
  });
};

export const notifyInfo = (title: string, options?: ToastOptions) => {
  toast.info(title, {
    description: options?.description,
    duration: options?.duration || 3000,
  });
};

export const notifyWarning = (title: string, options?: ToastOptions) => {
  toast.warning(title, {
    description: options?.description,
    duration: options?.duration || 3000,
  });
};

// Common operation notifications
export const notifyCreated = (itemType: string) => {
  notifySuccess(`${itemType} created`, {
    description: `The ${itemType.toLowerCase()} has been successfully created.`,
  });
};

export const notifyUpdated = (itemType: string) => {
  notifySuccess(`${itemType} updated`, {
    description: `The ${itemType.toLowerCase()} has been successfully updated.`,
  });
};

export const notifyDeleted = (itemType: string) => {
  notifySuccess(`${itemType} deleted`, {
    description: `The ${itemType.toLowerCase()} has been successfully deleted.`,
  });
};

export const notifyOperationFailed = (operation: string, error?: string) => {
  notifyError(`${operation} failed`, {
    description: error || "An unexpected error occurred. Please try again.",
  });
};
