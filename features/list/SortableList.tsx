import { NestableDraggableFlatList } from 'react-native-draggable-flatlist';
import type { GroceryItem } from '../../utils/groceries';
import ItemRow from './ItemRow';
export interface SortableProps {
  items: GroceryItem[]; disabled?: boolean;
  onReorder: (items: GroceryItem[], from: number, to: number) => void;
}
export default function SortableList({ items, disabled, onReorder }: SortableProps) {
  return <NestableDraggableFlatList data={items} keyExtractor={item => item.id}
    renderItem={({ item, drag, isActive }) => <ItemRow item={item} drag={disabled ? undefined : drag} active={isActive} />}
    onDragEnd={({ data, from, to }) => onReorder(data, from, to)} activationDistance={12} />;
}
