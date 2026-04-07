import { useState, useEffect } from 'react';

export function useTypewriter(strings = [], typeSpeed = 40, deleteSpeed = 20, pauseMs = 2000) {
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (strings.length === 0) return;

    let timeout;
    const currentString = strings[index % strings.length];

    if (!isDeleting) {
      if (text.length < currentString.length) {
        timeout = setTimeout(() => {
          setText(currentString.slice(0, text.length + 1));
        }, typeSpeed);
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, pauseMs);
      }
    } else {
      if (text.length > 0) {
        timeout = setTimeout(() => {
          setText(currentString.slice(0, text.length - 1));
        }, deleteSpeed);
      } else {
        setIsDeleting(false);
        setIndex((i) => i + 1);
      }
    }

    return () => clearTimeout(timeout);
  }, [text, isDeleting, index, strings, typeSpeed, deleteSpeed, pauseMs]);

  return text;
}
