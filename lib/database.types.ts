export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          blockly_xml: string | null
          generated_code: string | null
          target_board: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          blockly_xml?: string | null
          generated_code?: string | null
          target_board?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          blockly_xml?: string | null
          generated_code?: string | null
          target_board?: string
          created_at?: string
          updated_at?: string
        }
      }
      workspace_projects: {
        Row: {
          id: string
          user_id: string
          name: string
          board: string
          components: Json
          code: Json
          flashed: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          board?: string
          components?: Json
          code?: Json
          flashed?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          board?: string
          components?: Json
          code?: Json
          flashed?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export type WorkspaceProject = Database['public']['Tables']['workspace_projects']['Row']
export type WorkspaceProjectInsert = Database['public']['Tables']['workspace_projects']['Insert']
export type WorkspaceProjectUpdate = Database['public']['Tables']['workspace_projects']['Update']
