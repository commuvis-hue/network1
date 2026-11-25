export interface Profile {
  id: string;
  email: string | null;
  name: string;
  referral_code: string;
  role: 'member' | 'admin';
  status: 'active' | 'suspended';
  sponsor_id: string | null;
  binary_parent_id: string | null;
  binary_position: 'L' | 'R' | null;
  matrix_parent_id: string | null;
  matrix_position: number | null;
  rank_level: number;
  wallet_address: string | null;
  placed: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  pv: number;
  image_url: string | null;
  stock: number | null;
  active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  member_id: string;
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  payment_method: 'crypto' | 'manual';
  total_amount: number;
  total_pv: number;
  tx_hash: string | null;
  commissions_processed: boolean;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

export interface Commission {
  id: string;
  member_id: string;
  type: 'unilevel' | 'binary' | 'matrix' | 'rank';
  level: number;
  order_id: string | null;
  source_member_id: string | null;
  base_pv: number;
  rate: number;
  amount: number;
  status: 'confirmed' | 'reversed';
  created_at: string;
}

export interface RankRow {
  level: number;
  name: string;
  min_personal_pv: number;
  min_group_pv: number;
  min_direct_count: number;
  bonus_rate: number;
}

export interface TreeNode {
  id: string;
  parent_id: string | null;
  depth: number;
  name: string;
  referral_code: string;
  rank_level: number;
  binary_position: 'L' | 'R' | null;
  matrix_position: number | null;
  status: string;
  created_at: string;
}
