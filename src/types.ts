export interface OutlineItem {
  title: string | undefined;
  uri: string | undefined;
  open: boolean;
  down?: OutlineItem[];
  page?: number;
}

export interface Bookmark {
  name: string;
  page: number;
}
