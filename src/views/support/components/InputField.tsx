export default function InputField(props: { label: string; placeholder: string }) {
   return (
      <div className="flex flex-col gap-1">
         <label className="text-sm text-blue-600">{props.label}</label>
         <input
            type="text"
            className="bg-transparent border-b border-blue-600 py-2 px-1 focus:outline-none text-sm"
            placeholder={props.placeholder}
         ></input>
      </div>
   );
}
