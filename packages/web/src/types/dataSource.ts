export interface DataSource {
  id: string;
  name: string;
  provider: string;
  url: string;
  is_active: number;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
