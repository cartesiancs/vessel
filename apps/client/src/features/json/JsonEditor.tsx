import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

interface JsonCodeEditorProps extends ReactCodeMirrorProps {
  value: string;
  onChange: (value: string) => void;
}

export const JsonCodeEditor: React.FC<JsonCodeEditorProps> = ({
  value,
  onChange,
  ...props
}) => {
  return (
    <div className='rounded-md border'>
      <CodeMirror
        value={value}
        onChange={onChange}
        height='240px'
        extensions={[json()]}
        theme='dark'
        style={{
          fontSize: "0.875rem",
          fontFamily: "var(--font-mono)",
        }}
        {...props}
      />
    </div>
  );
};
