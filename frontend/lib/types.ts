export type User = {
  id: number;
  first_name: string;
  display_name: string;
  payroll_role: string;
  hotel_role: string | null;
  role: string;
  modules: string[];
  default_route: string;
};

export type EmployeeRow = {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  payroll_role: string;
  hotel_role: string | null;
  effective_hotel_role: string | null;
};

export type ItemSubcategory = "snacks" | "drinks";

export type SnacksEntry = {
  item_id: number;
  name: string;
  subcategory: ItemSubcategory;
  previous_closing: number;
  previous_from_date?: string | null;
  added_stock: number | null;
  closing_stock: number | null;
  total_units?: number | null;
  sold_units?: number | null;
  price_ksh?: number;
  revenue?: number | null;
  record_id?: number | null;
  over_closing?: boolean;
};

export type StockEntry = {
  item_id: number;
  name: string;
  closing_stock: number;
  added_stock: number;
  opening_units?: number;
  next_closing_units?: number;
  sold_units?: number;
  price_ksh?: number;
  revenue?: number;
  record_id?: number | null;
};

export type QuantityEntry = {
  item_id: number;
  name: string;
  quantity: number;
  price_ksh: number;
  record_id?: number | null;
};

export type PriceItem = {
  id: number;
  name: string;
  group_type: string;
  subcategory?: ItemSubcategory | null;
  price_ksh: number;
  price_id?: number | null;
};

export type BarEntry = {
  item_id: number;
  name: string;
  display_order?: number;
  opening_stock: number;
  added_stock: number | null;
  closing_stock: number | null;
  total_units?: number | null;
  sold_units?: number | null;
  price_ksh?: number;
  revenue?: number | null;
  record_id?: number | null;
  opening_from_date?: string | null;
  over_closing?: boolean;
};

export type AuditRow = {
  item_id: number;
  item_name: string;
  entry_date: string;
  subcategory?: "snacks" | "drinks" | null;
  opening_stock?: number;
  closing_stock?: number;
  added_stock?: number;
  next_closing_units?: number;
  sold_units?: number;
  total_units?: number;
  quantity?: number;
  price_ksh?: number;
  revenue?: number;
};

export type SalesAuditCategoryKey =
  | "ugali"
  | "rice"
  | "matumbo"
  | "kuku"
  | "mix"
  | "fries"
  | "managu";

export type SalesAuditDish = {
  item_id: number;
  item_name: string;
  plates: number;
  revenue: number;
};

export type SalesAuditCategory = {
  key: SalesAuditCategoryKey;
  label: string;
  plates: number;
  revenue: number;
  dishes: SalesAuditDish[];
};

export type SalesAuditSnackRow = {
  item_id: number;
  item_name: string;
  entry_date: string;
  added: number;
  sold: number;
  revenue: number;
};

export type SalesAuditSnackTotal = Omit<SalesAuditSnackRow, "entry_date">;

export type SalesAuditDay = {
  entry_date: string;
  snacks: number;
  drinks: number;
  food: number;
  kuku: number;
  total: number;
};

export type SalesAuditReport = {
  date_from: string;
  date_to: string;
  categories: SalesAuditCategory[];
  chapati: {
    cooked: number;
    dish_plates: number;
    chapatis_used: number;
    pct: number;
  };
  snacks_added: SalesAuditSnackRow[];
  snack_totals: SalesAuditSnackTotal[];
  drinks_added: SalesAuditSnackRow[];
  drink_totals: SalesAuditSnackTotal[];
  timeseries: SalesAuditDay[];
};

export type AnalyticsRange = "yesterday" | "7d" | "30d" | "90d";
export type AnalyticsCategory = "snacks" | "drinks" | "food" | "kuku";

export type AnalyticsGroupTotal = {
  key: AnalyticsCategory;
  label: string;
  sold_units: number;
  revenue: number;
};

export type AnalyticsItemSold = {
  item_id: number;
  name: string;
  sold_units: number;
  revenue: number;
};

export type TillsDay = {
  day: string;
  total: number;
  sales_total: number;
  pct: number;
};

export type TillsReport = {
  date_from: string;
  date_to: string;
  phone_number: string;
  period_total: number;
  sales_period_total: number;
  tills_pct: number;
  timeseries: TillsDay[];
};

export const HOTEL_ROLE_OPTIONS = [
  { value: "", label: "None" },
  { value: "snacks_clerk", label: "Snacks Clerk" },
  { value: "food_clerk", label: "Food Clerk" },
  { value: "stock_clerk", label: "Stock Clerk" },
  { value: "bar_clerk", label: "Bar Clerk" },
  { value: "admin", label: "Hotel Admin" },
];
