'use client';

import React, { useState } from 'react';
import { PageHeading } from './SectionHeading';
import { TherapistCard } from './TherapistCard';
import { TherapistFilter } from './TherapistFilter';
import { Therapist, ConfirmedShift } from '../../types/store';

interface TherapistFilterableGridProps {
  therapists: Therapist[];
  todayShifts: ConfirmedShift[];
  shopSlug: string;
  basePath?: string;
  isCyber: boolean;
  isLuxury?: boolean;
  primaryColor?: string;
}

/**
 * セラピスト一覧のタグ絞り込み部分。
 *
 * ページ本体をサーバーコンポーネント化（=一覧をHTMLに載せてSEO対応する）
 * にあたり、クライアント状態が必要なのはこのタグ絞り込みだけなので、
 * ここだけをクライアントコンポーネントとして切り出している。
 * セラピスト一覧はサーバーで取得済みのものを props で受け取るため、
 * JSが無効でも（=クローラにも）カードは表示される。
 */
export const TherapistFilterableGrid: React.FC<TherapistFilterableGridProps> = ({
  therapists,
  todayShifts,
  shopSlug,
  basePath,
  isCyber,
  isLuxury = false,
  primaryColor,
}) => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const todayShiftMap = new Map(todayShifts.map((s) => [s.therapistId, s]));
  const allTags = Array.from(new Set(therapists.flatMap((t) => t.tags)));
  const filteredTherapists = selectedTag
    ? therapists.filter((t) => t.tags.includes(selectedTag))
    : therapists;

  return (
    <>
      <div className="text-center mb-8">
        <PageHeading title="Therapist" subtitle="セラピスト一覧" isCyber={isCyber} isLuxury={isLuxury} />

        <TherapistFilter
          tags={allTags}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          isCyber={isCyber}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {filteredTherapists.map((therapist, idx) => {
          const todayShift = todayShiftMap.get(therapist.id);
          return (
            <TherapistCard
              key={therapist.id}
              therapist={therapist}
              storeSlug={shopSlug}
              basePath={basePath}
              confirmedShiftTime={todayShift ? `${todayShift.startTime}~${todayShift.endTime}` : undefined}
              showTodayBadge={!!todayShift}
              primaryColor={primaryColor}
              index={idx}
            />
          );
        })}
      </div>
    </>
  );
};
