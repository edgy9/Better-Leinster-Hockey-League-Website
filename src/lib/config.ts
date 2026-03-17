export interface Season {
  label: string;
  val: string;
  yearId: string;
  current?: boolean;
}

export const SEASONS: Season[] = [
  { label: "2025/26", val: "2025-2026", yearId: "3931", current: true },
  { label: "2024/25", val: "2024-2025", yearId: "3760" },
  { label: "2023/24", val: "2023-2024", yearId: "3342" },
  { label: "2022/23", val: "2022-2023", yearId: "2990" },
  { label: "2021/22", val: "2021-2022", yearId: "2735" },
  { label: "2020/21", val: "2020-2021", yearId: "2383" },
  { label: "2019/20", val: "2019-2020", yearId: "2162" },
  { label: "2018/19", val: "2018-2019", yearId: "1987" },
  { label: "2017/18", val: "2017-2018", yearId: "1562" },
  { label: "2016/17", val: "2016-2017", yearId: "1561" },
  { label: "2015/16", val: "2015-2016", yearId: "1560" },
  { label: "2014/15", val: "2014-2015", yearId: "1395" },
  { label: "2013/14", val: "2013-2014", yearId: "927" },
  { label: "2012/13", val: "2012-2013", yearId: "925" },
];

/**
 * A GroupMatcher finds API groups by exact `groupid` match (primary)
 * or by a substring in `group_name` (fallback). Both are case-insensitive.
 *
 * Why both fields: `groupid` changes between seasons (e.g. "BClub" vs "Boys Club")
 * but group_name terms like "boys club" are stable enough to use as fallback.
 */
export interface GroupMatcher {
  groupids: string[];   // exact match against api group.groupid
  nameTerms?: string[]; // fallback: any term found in api group.group_name
}

/**
 * A WhoOption maps a UI label ("Men", "Boys", etc.) to one or more
 * GroupMatchers. Multiple matchers are OR'd — all matching groups are fetched
 * and their competitions merged. This handles the schoolgirls case where
 * Leinster Schoolgirls + SE Schoolgirls are both under "Girls".
 */
export interface WhoOption {
  label: string;
  matchers: GroupMatcher[];
}

export interface SectionCfg {
  label: string;
  who: WhoOption[] | null;
  matchers?: GroupMatcher[]; // used when who is null (no sub-step)
}

export const SECTION_CONFIG: Record<string, SectionCfg> = {
  senior_club: {
    label: "Senior Club",
    who: [
      {
        label: "Men",
        matchers: [{ groupids: ["Men"], nameTerms: ["mens", "men's"] }],
      },
      {
        label: "Women",
        matchers: [{ groupids: ["Women"], nameTerms: ["womens", "women's"] }],
      },
    ],
  },
  junior_club: {
    label: "Junior Club",
    who: [
      {
        label: "Boys",
        // 2025/26: "BClub", 2024/25: "Boys Club"
        matchers: [{ groupids: ["BClub", "Boys Club"], nameTerms: ["boys club"] }],
      },
      {
        label: "Girls",
        // 2025/26: "GClub", 2024/25: "Girls Club"
        matchers: [{ groupids: ["GClub", "Girls Club"], nameTerms: ["girls club"] }],
      },
    ],
  },
  school: {
    label: "Schools",
    who: [
      {
        label: "Boys",
        matchers: [{ groupids: ["Schoolboys", "SB"], nameTerms: ["schoolboy"] }],
      },
      {
        label: "Girls",
        // Two separate groups both shown under Girls:
        // Leinster Schoolgirls (2025/26: "Schoolgirls") and
        // SE Schoolgirls (2025/26: "SESG", 2024/25: "SE Schools")
        matchers: [
          { groupids: ["Schoolgirls", "SG"], nameTerms: ["schoolgirl"] },
          { groupids: ["SESG", "SE Schools"], nameTerms: ["south east school", "se schoolgirl"] },
        ],
      },
    ],
  },
  primary: {
    label: "Primary School",
    who: null,
    // 2025/26: "Primarysch", 2024/25: "Primary Schools"
    matchers: [{ groupids: ["Primarysch", "Primary Schools"], nameTerms: ["primary"] }],
  },
  indoor: {
    label: "Indoor",
    who: null,
    matchers: [{ groupids: ["Indoor"], nameTerms: ["indoor"] }],
  },
};

export const RESULT_TITLES: Record<string, Record<string, string>> = {
  senior_club: { Men: "Men's Senior Club", Women: "Women's Senior Club" },
  junior_club: { Boys: "Boys' Club", Girls: "Girls' Club" },
  school: { Boys: "Schoolboys", Girls: "Schoolgirls" },
};

export const PROXY_BASE = "/api/proxy";
