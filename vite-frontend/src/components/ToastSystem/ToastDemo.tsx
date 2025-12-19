import { TOAST_CONFIGS } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { type ShowToast as ShowToastType, TOAST_TYPES, type ToastConfigKey, type ToastData } from '@/components/ToastSystem/types';

interface DemoButton {
   type?: string;
   label: string;
   action?: () => void;
   className: string;
   configKey?: ToastConfigKey;
   customData?: ToastData;
}

interface DemoConfig {
   basicTypes: DemoButton[];
   successToasts: DemoButton[];
   errorToasts: DemoButton[];
   infoToasts: DemoButton[];
   warningToasts: DemoButton[];
}

const createDemoConfig = (showToast: ShowToastType): DemoConfig => {
   // Basic type examples
   const basicTypes = [
      {
         type: 'success',
         label: 'Success',
         action: () => showToast(TOAST_TYPES.SUCCESS, 'Success!', 'Operation completed successfully!'),
         className: 'bg-green-500 hover:bg-green-600'
      },
      {
         type: 'info',
         label: 'Info',
         action: () => showToast(TOAST_TYPES.INFO, 'Info', 'Here is some information.'),
         className: 'bg-blue-500 hover:bg-blue-600'
      },
      {
         type: 'error',
         label: 'Error',
         action: () => showToast(TOAST_TYPES.ERROR, 'Error!', 'Something went wrong.'),
         className: 'bg-red-500 hover:bg-red-600'
      },
      {
         type: 'warning',
         label: 'Warning',
         action: () => showToast(TOAST_TYPES.WARNING, 'Warning', 'Please check this.'),
         className: 'bg-gray-500 hover:bg-gray-600'
      }
   ];

   // Group toasts by type
   const toastsByType = Object.entries(TOAST_CONFIGS).reduce((acc: Record<string, DemoButton[]>, [key, config]) => {
      const type = config.toastType.toLowerCase();
      if (!acc[type]) acc[type] = [];

      // Create demo data based on config
      const demoData: DemoButton = {
         configKey: key as ToastConfigKey,
         label: config.title,
         className: `${
            type === 'success'
               ? 'bg-green-500 hover:bg-green-600'
               : type === 'error'
                 ? 'bg-red-500 hover:bg-red-600'
                 : type === 'info'
                   ? 'bg-blue-500 hover:bg-blue-600'
                   : 'bg-gray-500 hover:bg-gray-600'
         }`
      };

      // Add example data for specific toasts
      if (key === 'points_earned') {
         demoData.customData = { points: 75, reason: 'example' };
      } else if (key.includes('error')) {
         demoData.customData = { error: 'Example error message' };
      }

      acc[type].push(demoData);
      return acc;
   }, {});

   return {
      basicTypes,
      successToasts: toastsByType.success || [],
      errorToasts: toastsByType.error || [],
      infoToasts: toastsByType.info || [],
      warningToasts: toastsByType.warning || []
   };
};

// Helper component for rendering button groups
const ButtonGroup = ({
   title,
   buttons,
   showToastByConfig
}: {
   title: string;
   buttons: DemoButton[];
   showToastByConfig: (configKey: ToastConfigKey, customData?: ToastData) => void;
}) => (
   <div className="space-y-2">
      <h3 className="font-semibold text-lg mb-4">{title}</h3>
      {buttons.map((button: DemoButton) => (
         <button
            key={button.label}
            onClick={() => {
               if (button.action) {
                  button.action();
               } else if (button.configKey) {
                  showToastByConfig(button.configKey, button.customData);
               }
            }}
            className={`w-full px-4 py-2 text-white rounded text-sm ${button.className}`}
         >
            {button.label}
         </button>
      ))}
   </div>
);

const ToastDemo = () => {
   const { showToastByConfig, showToast, clearAllToasts } = useToast();

   // Create config with the actual showToast function
   const demoConfig = createDemoConfig(showToast);

   return (
      <div className="p-8 bg-gray-100 min-h-screen">
         <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-center">Simple Toast Demo</h1>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
               <ButtonGroup title="Basic Types" buttons={demoConfig.basicTypes} showToastByConfig={showToastByConfig} />

               <ButtonGroup title="Success" buttons={demoConfig.successToasts} showToastByConfig={showToastByConfig} />

               <ButtonGroup title="Info" buttons={demoConfig.infoToasts} showToastByConfig={showToastByConfig} />

               <ButtonGroup title="Warning" buttons={demoConfig.warningToasts} showToastByConfig={showToastByConfig} />

               <ButtonGroup title="Errors" buttons={demoConfig.errorToasts} showToastByConfig={showToastByConfig} />

               <div className="space-y-2">
                  <h3 className="font-semibold text-lg mb-4">Controls</h3>
                  <button onClick={clearAllToasts} className="w-full px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm">
                     Clear All
                  </button>
               </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
               <h3 className="font-semibold text-blue-800 mb-2">Usage:</h3>
               <pre className="text-sm text-blue-700">
                  {`import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';

const { showToastByConfig, showToast } = useToast();

// Simple usage (basic types)
showToast(TOAST_TYPES.SUCCESS, 'Title', 'Message');
showToast(TOAST_TYPES.ERROR, 'Error', 'Something failed');

// With action button
showToast(TOAST_TYPES.SUCCESS, 'Done!', 'Task completed', 'View Details', 'view_details');

// Business logic - just pass the config key!
showToastByConfig('funding_success', { transactionId: 'tx_123' });
showToastByConfig('points_earned', { points: 50 });
showToastByConfig('verification_success', { userId: 'user_123' });`}
               </pre>
            </div>
         </div>
      </div>
   );
};

export default ToastDemo;
