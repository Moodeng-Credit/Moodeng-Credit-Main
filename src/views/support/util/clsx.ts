type ClassValue = string | number | false | null | undefined | ClassValue[] | { [key: string]: boolean | undefined | null };

//TODO: use https://www.npmjs.com/package/clsx instead
export function clsx(...inputs: ClassValue[]): string {
   const classes: string[] = [];

   const toClass = (value: ClassValue): void => {
      if (!value) return;

      if (typeof value === 'string' || typeof value === 'number') {
         classes.push(String(value));
         return;
      }

      if (Array.isArray(value)) {
         value.forEach(toClass);
         return;
      }

      if (typeof value === 'object') {
         for (const key in value) {
            if (value[key]) classes.push(key);
         }
      }
   };

   inputs.forEach(toClass);

   return classes.join(' ');
}
