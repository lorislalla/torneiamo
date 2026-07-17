export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      invite_claims: {
        Row: { created_at: string; id: number; token_hash: string; user_id: string };
        Insert: { created_at?: string; id?: never; token_hash: string; user_id?: string };
        Update: { created_at?: string; id?: never; token_hash?: string; user_id?: string };
        Relationships: [];
      };
      profiles: {
        Row: { created_at: string; display_name: string; id: string; updated_at: string };
        Insert: { created_at?: string; display_name: string; id: string; updated_at?: string };
        Update: { created_at?: string; display_name?: string; id?: string; updated_at?: string };
        Relationships: [];
      };
      tournament_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: number;
          revoked_at: string | null;
          role: string;
          token_hash: string;
          tournament_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: never;
          revoked_at?: string | null;
          role: string;
          token_hash: string;
          tournament_id: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: never;
          revoked_at?: string | null;
          role?: string;
          token_hash?: string;
          tournament_id?: string;
        };
        Relationships: [{
          foreignKeyName: "tournament_invites_tournament_id_fkey";
          columns: ["tournament_id"];
          isOneToOne: false;
          referencedRelation: "tournaments";
          referencedColumns: ["id"];
        }];
      };
      tournament_members: {
        Row: { joined_at: string; role: string; tournament_id: string; user_id: string };
        Insert: { joined_at?: string; role: string; tournament_id: string; user_id: string };
        Update: { joined_at?: string; role?: string; tournament_id?: string; user_id?: string };
        Relationships: [{
          foreignKeyName: "tournament_members_tournament_id_fkey";
          columns: ["tournament_id"];
          isOneToOne: false;
          referencedRelation: "tournaments";
          referencedColumns: ["id"];
        }];
      };
      tournaments: {
        Row: {
          created_at: string;
          data: Json;
          format: string;
          id: string;
          name: string;
          owner_id: string;
          revision: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data: Json;
          format: string;
          id: string;
          name: string;
          owner_id: string;
          revision?: number;
          status: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          format?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          revision?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
