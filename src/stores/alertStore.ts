import { create } from 'zustand';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  showAlert: (title: string, message: string, buttons?: AlertButton[]) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: '',
  buttons: [],
  showAlert: (title, message, buttons = []) => {
    // If no buttons are provided, default to a standard OK button
    const alertButtons = buttons.length > 0 
      ? buttons 
      : [{ text: 'OK' }];
    set({
      visible: true,
      title,
      message,
      buttons: alertButtons,
    });
  },
  hideAlert: () => set({ visible: false }),
}));

/**
 * Global helper function to trigger the custom alert.
 * Can be called from anywhere (components, hooks, or vanilla TS services).
 */
export function customAlert(title: string, message: string = '', buttons?: AlertButton[]): void {
  useAlertStore.getState().showAlert(title, message, buttons);
}
