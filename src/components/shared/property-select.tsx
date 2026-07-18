"use client";

import { SelectItem } from "@/components/ui/select";
import { useAppStore } from "@/lib/store";

/** Items de sélection d'un logement, réutilisés dans plusieurs formulaires. */
export function PropertySelectItems() {
  const { data } = useAppStore();
  return (
    <>
      {data.properties.map((property) => (
        <SelectItem key={property.id} value={property.id}>
          {property.name}
        </SelectItem>
      ))}
    </>
  );
}
