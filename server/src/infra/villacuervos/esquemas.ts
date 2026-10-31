export interface PublicRoleSchema {
  key: string;
  name: string;
  type: string;
  edition: string;
  ability: string;
  reminders: string | null;
  global_reminders: string | null;
  first_night: string | null;
  other_nights: string | null;
  first_night_order: number | null;
  other_nights_order: number | null;
  setup: boolean;
  special: string | null;
  image: string | null;
}

export interface PublicJinxSchema {
  first_role: string;
  second_role: string;
  text: string;
}

export interface PublicPackSchema {
  slug: string;
  name: string;
  language: string | null;
  has_genres: boolean;
}

export interface PublicTranslationSchema {
  role: string;
  name: string;
  ability: string;
  reminders: string | null;
  global_reminders: string | null;
  first_night: string | null;
  other_nights: string | null;
}

export interface PublicPlayListSchema {
  id: number;
  name: string;
  order: number;
  max_players: number | null;
  player_count: number;
}

export interface PublicPlaySchema {
  id: number;
  name: string;
  slug: string;
  date: string;
  script_name: string | null;
  in_person: boolean;
  lists: PublicPlayListSchema[];
}

export interface PublicPlayListCreateSchema {
  name: string;
  order: number;
  max_players?: number | null;
}

export interface PublicPlayCreateSchema {
  name: string;
  date: string;
  text?: string | null;
  script_id?: number | null;
  link?: string | null;
  address?: string | null;
  rules_explanation?: boolean;
  roles_explanation?: boolean;
  multiple_lists?: boolean;
  difficulty?: number | null;
  age_limit?: number | null;
  public?: boolean;
  in_person?: boolean;
  lists: PublicPlayListCreateSchema[];
}

export interface PublicPlayUpdateSchema {
  name?: string | null;
  date?: string | null;
  text?: string | null;
  script_id?: number | null;
  link?: string | null;
  address?: string | null;
  rules_explanation?: boolean | null;
  roles_explanation?: boolean | null;
  multiple_lists?: boolean | null;
  difficulty?: number | null;
  age_limit?: number | null;
  public?: boolean | null;
  in_person?: boolean | null;
}
