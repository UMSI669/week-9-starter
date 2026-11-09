import { useRef } from 'react';
import type { SortableProps } from './SortableList';
import ItemRow from './ItemRow';
export default function SortableList({ items, disabled, onReorder }: SortableProps) {
  const dragged = useRef<number | null>(null);
  return <div>{items.map((item, index) => <div key={item.id} draggable={!disabled}
    onDragStart={event => { dragged.current = index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); }}
    onDragOver={event => event.preventDefault()} onDragEnd={() => { dragged.current = null; }}
    onDrop={event => {
      event.preventDefault(); const from = dragged.current; dragged.current = null;
      if (disabled || from === null || from === index) return;
      const ordered = [...items]; const [moved] = ordered.splice(from, 1); ordered.splice(index, 0, moved);
      onReorder(ordered, from, index);
    }}><ItemRow item={item} /></div>)}</div>;
}
