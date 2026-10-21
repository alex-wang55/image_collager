export type Profile = {
  id: string;
  username: string;
  display_name: string;
  color: string;
};

export type Person = Pick<Profile, "id" | "display_name" | "color">;

export type Photo = {
  id: string;
  board_id: string;
  user_id: string | null;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  bytes: number;
  color: string | null;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
  /** taken_at if known, else created_at (generated column) */
  shot_at: string;
};

export type Board = {
  id: string;
  name: string;
  created_by: string | null;
  invite_code: string;
  cover_photo_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Member = {
  board_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profile: Person | null;
};

/** One row of collage_my_boards(). */
export type BoardSummary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  role: "owner" | "member";
  photo_count: number;
  new_count: number;
  covers: Pick<Photo, "id" | "thumb_path" | "width" | "height" | "color">[];
  members: Person[];
};

export type Memory = Pick<Photo, "id" | "board_id" | "thumb_path" | "path" | "width" | "height" | "color" | "caption" | "created_at" | "taken_at"> & {
  board_name: string;
  on_this_day: boolean;
};
