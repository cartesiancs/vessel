interface AnimatedHeadingProps {
  /** Each string is rendered on its own visual line (replaces the old <br />). */
  lines: string[];
  className?: string;
}

/**
 * Renders a heading split into per-word spans tagged `data-reveal`, so an
 * ancestor running `useStaggerReveal` can animate the words in sequence.
 */
export function AnimatedHeading({ lines, className }: AnimatedHeadingProps) {
  const parsed = lines.map((line) => line.split(/\s+/).filter(Boolean));

  return (
    <h1 className={className}>
      {parsed.map((line, lineIndex) => (
        <span key={lineIndex} className='block'>
          {line.map((word, wordIndex) => (
            <span key={`${lineIndex}-${wordIndex}`}>
              <span data-reveal className='inline-block will-change-transform'>
                {word}
              </span>
              {wordIndex < line.length - 1 ? " " : null}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

export default AnimatedHeading;
