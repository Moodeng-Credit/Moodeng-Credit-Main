import { useId } from 'react';

import { clsx } from '@/views/support/util/clsx';

export default function RadioField(props: { label: string; name: string }) {
   const id = useId();
   // const [checked, setChecked] = useState(false);
   const checked = false;

   return (
      <div className="flex gap-2 items-center">
         <input
            id={id}
            type="radio"
            name={props.name}
            className={clsx('appearance-none w-3 h-3 border rounded-full cursor-pointer', {
               'bg-blue-600 border-blue-600': checked,
               'bg-gray-400 border-gray-400': !checked
            })}
         ></input>
         <label htmlFor={id} className="cursor-pointer text-sm">
            {props.label}
         </label>
      </div>
   );
}
