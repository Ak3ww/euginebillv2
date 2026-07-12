'use client';
import { useEffect } from 'react';

export default function PrintAction() {
  useEffect(() => {
    setTimeout(() => {
      window.print();
    }, 500);
  }, []);
  return null;
}
