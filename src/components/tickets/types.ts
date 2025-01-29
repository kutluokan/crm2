export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Customer {
  id: string;
  email?: string;
  full_name?: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  customer?: Customer;
  tags: Tag[];
  created_at: string;
  updated_at: string;
} 