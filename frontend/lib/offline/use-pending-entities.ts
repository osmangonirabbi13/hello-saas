'use client';
import { useEffect, useState } from 'react';
import { getOfflineDb } from './db';
import { currentOfflineScope, OfflineWorkflowRepository } from './workflows';
import type { EffectiveEntity, EntityType } from './types';

export function usePendingEntities(entityType: EntityType) {
  const [entities, setEntities] = useState<EffectiveEntity[]>([]);
  useEffect(() => {
    const db = getOfflineDb();
    const refresh = () =>
      new OfflineWorkflowRepository(db).effectiveList(currentOfflineScope(), entityType).then(setEntities);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [entityType]);
  return entities;
}
