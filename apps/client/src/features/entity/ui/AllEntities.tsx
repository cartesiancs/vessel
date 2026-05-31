import { Fragment } from "react";
// import { EntityAll } from "@/entities/entity";
import { EntityCard } from "./Card";
import {
  // StreamState,
  useEntitiesData,
} from "@/features/entity";

export function AllEntities() {
  const { entities, streamsState } = useEntitiesData();

  return (
    <>
      <div className='grid grid-cols-1 gap-4 px-0 sm:grid-cols-2 lg:grid-cols-4 lg:px-6'>
        {entities.map((item) => (
          <Fragment key={item.id}>
            <EntityCard item={item} streamsState={streamsState} />
          </Fragment>
        ))}
      </div>
    </>
  );
}
