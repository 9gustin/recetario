
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_conversations": {
                  Row: {
                    "context": NonNullable<Json>,"created_at": string,"group_id": string,"id": string,"last_message_at": string,"plan_id": string | null,"purpose": string,"title": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: NonNullable<Json>,"created_at"?: string,"group_id": string,"id"?: string,"last_message_at"?: string,"plan_id"?: string | null,"purpose": string,"title"?: string | null,"user_id": string
                  }
                  Update: {
                    "context"?: NonNullable<Json>,"created_at"?: string,"group_id"?: string,"id"?: string,"last_message_at"?: string,"plan_id"?: string | null,"purpose"?: string,"title"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_conversations_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_conversations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_messages": {
                  Row: {
                    "content": NonNullable<Json>,"conversation_id": string,"created_at": string,"id": string,"mentions": (string)[],"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"conversation_id": string,"created_at"?: string,"id"?: string,"mentions"?: (string)[],"role": string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"conversation_id"?: string,"created_at"?: string,"id"?: string,"mentions"?: (string)[],"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_quota": {
                  Row: {
                    "count": number,"day": string,"feature": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"day": string,"feature": string,"user_id": string
                  }
                  Update: {
                    "count"?: number,"day"?: string,"feature"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_quota_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_runs": {
                  Row: {
                    "cache_read_tokens": number | null,"created_at": string,"error": string | null,"feature": string,"group_id": string | null,"id": string,"input_tokens": number | null,"latency_ms": number | null,"model": string,"output_tokens": number | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_read_tokens"?: number | null,"created_at"?: string,"error"?: string | null,"feature": string,"group_id"?: string | null,"id"?: string,"input_tokens"?: number | null,"latency_ms"?: number | null,"model": string,"output_tokens"?: number | null,"status": string,"user_id": string
                  }
                  Update: {
                    "cache_read_tokens"?: number | null,"created_at"?: string,"error"?: string | null,"feature"?: string,"group_id"?: string | null,"id"?: string,"input_tokens"?: number | null,"latency_ms"?: number | null,"model"?: string,"output_tokens"?: number | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_runs_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_runs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cooking_sessions": {
                  Row: {
                    "current_step": number,"finished_at": string | null,"id": string,"note": string | null,"pending_edits": NonNullable<Json>,"photo_url": string | null,"plan_entry_id": string | null,"rating": number | null,"recipe_id": string,"recipe_version": number,"servings": number,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "current_step"?: number,"finished_at"?: string | null,"id"?: string,"note"?: string | null,"pending_edits"?: NonNullable<Json>,"photo_url"?: string | null,"plan_entry_id"?: string | null,"rating"?: number | null,"recipe_id": string,"recipe_version": number,"servings": number,"started_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "current_step"?: number,"finished_at"?: string | null,"id"?: string,"note"?: string | null,"pending_edits"?: NonNullable<Json>,"photo_url"?: string | null,"plan_entry_id"?: string | null,"rating"?: number | null,"recipe_id"?: string,"recipe_version"?: number,"servings"?: number,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cooking_sessions_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cooking_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"food_profile_drafts": {
                  Row: {
                    "changes": NonNullable<Json>,"created_at": string,"id": string,"input_ids": (string)[],"open_questions": NonNullable<Json>,"proposed": NonNullable<Json>,"status": string,"summary": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changes"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"input_ids"?: (string)[],"open_questions"?: NonNullable<Json>,"proposed": NonNullable<Json>,"status"?: string,"summary"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "changes"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"input_ids"?: (string)[],"open_questions"?: NonNullable<Json>,"proposed"?: NonNullable<Json>,"status"?: string,"summary"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "food_profile_drafts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"food_profile_inputs": {
                  Row: {
                    "ai_run_id": string | null,"created_at": string,"id": string,"kind": string,"processed_at": string | null,"storage_path": string | null,"transcript": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_run_id"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"processed_at"?: string | null,"storage_path"?: string | null,"transcript"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "ai_run_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"processed_at"?: string | null,"storage_path"?: string | null,"transcript"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "food_profile_inputs_ai_run_id_fkey"
      columns: ["ai_run_id"]
isOneToOne: false
      referencedRelation: "ai_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "food_profile_inputs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"food_profiles": {
                  Row: {
                    "data": NonNullable<Json>,"summary": string | null,"updated_at": string,"user_id": string,"valid_until": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "data"?: NonNullable<Json>,"summary"?: string | null,"updated_at"?: string,"user_id": string,"valid_until"?: string | null,"version"?: number
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"summary"?: string | null,"updated_at"?: string,"user_id"?: string,"valid_until"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "food_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string | null,"group_id": string,"id": string,"max_uses": number | null,"revoked_at": string | null,"token": string,"updated_at": string,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"group_id": string,"id"?: string,"max_uses"?: number | null,"revoked_at"?: string | null,"token": string,"updated_at"?: string,"uses"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"group_id"?: string,"id"?: string,"max_uses"?: number | null,"revoked_at"?: string | null,"token"?: string,"updated_at"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_invites_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "group_id": string,"joined_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"joined_at"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"joined_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"emoji": string | null,"id": string,"image_url": string | null,"is_personal": boolean,"meal_slots": (string)[],"name": string,"updated_at": string,"week_starts_on": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"emoji"?: string | null,"id"?: string,"image_url"?: string | null,"is_personal"?: boolean,"meal_slots"?: (string)[],"name": string,"updated_at"?: string,"week_starts_on"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"emoji"?: string | null,"id"?: string,"image_url"?: string | null,"is_personal"?: boolean,"meal_slots"?: (string)[],"name"?: string,"updated_at"?: string,"week_starts_on"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inbox_items": {
                  Row: {
                    "created_at": string,"from_user_id": string | null,"id": string,"kind": string,"payload": NonNullable<Json>,"read_at": string | null,"resolved_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_user_id"?: string | null,"id"?: string,"kind": string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"resolved_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"from_user_id"?: string | null,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"resolved_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbox_items_from_user_id_fkey"
      columns: ["from_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbox_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ingredients": {
                  Row: {
                    "aisle": string | null,"aliases": (string)[],"created_at": string,"created_by_ai": boolean,"default_unit": string | null,"family": (string)[],"id": string,"name": string,"nutrition_per_100g": Json | null,"reviewed": boolean,"shelf_life": Json | null,"storage_tips": string | null,"unit_weight_g": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle"?: string | null,"aliases"?: (string)[],"created_at"?: string,"created_by_ai"?: boolean,"default_unit"?: string | null,"family"?: (string)[],"id"?: string,"name": string,"nutrition_per_100g"?: Json | null,"reviewed"?: boolean,"shelf_life"?: Json | null,"storage_tips"?: string | null,"unit_weight_g"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "aisle"?: string | null,"aliases"?: (string)[],"created_at"?: string,"created_by_ai"?: boolean,"default_unit"?: string | null,"family"?: (string)[],"id"?: string,"name"?: string,"nutrition_per_100g"?: Json | null,"reviewed"?: boolean,"shelf_life"?: Json | null,"storage_tips"?: string | null,"unit_weight_g"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_plan_entries": {
                  Row: {
                    "cook_date": string | null,"created_at": string,"date": string,"diner_ids": (string)[],"free_text": string | null,"id": string,"is_new_recipe": boolean,"leftovers_of_entry_id": string | null,"plan_id": string,"position": number,"recipe_id": string | null,"servings": number | null,"slot": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cook_date"?: string | null,"created_at"?: string,"date": string,"diner_ids"?: (string)[],"free_text"?: string | null,"id"?: string,"is_new_recipe"?: boolean,"leftovers_of_entry_id"?: string | null,"plan_id": string,"position"?: number,"recipe_id"?: string | null,"servings"?: number | null,"slot": string,"updated_at"?: string
                  }
                  Update: {
                    "cook_date"?: string | null,"created_at"?: string,"date"?: string,"diner_ids"?: (string)[],"free_text"?: string | null,"id"?: string,"is_new_recipe"?: boolean,"leftovers_of_entry_id"?: string | null,"plan_id"?: string,"position"?: number,"recipe_id"?: string | null,"servings"?: number | null,"slot"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_plan_entries_leftovers_of_entry_id_fkey"
      columns: ["leftovers_of_entry_id"]
isOneToOne: false
      referencedRelation: "meal_plan_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plan_entries_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plan_entries_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_plans": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"created_by": string | null,"generation_context": Json | null,"group_id": string,"id": string,"notes": string | null,"status": string,"title": string | null,"updated_at": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"generation_context"?: Json | null,"group_id": string,"id"?: string,"notes"?: string | null,"status"?: string,"title"?: string | null,"updated_at"?: string,"week_start": string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"generation_context"?: Json | null,"group_id"?: string,"id"?: string,"notes"?: string | null,"status"?: string,"title"?: string | null,"updated_at"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_plans_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plans_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"prep_tasks": {
                  Row: {
                    "created_at": string,"details": string | null,"done_at": string | null,"done_by": string | null,"duration_minutes": number | null,"id": string,"kind": string,"plan_id": string,"related_entry_ids": (string)[],"remind_at": string | null,"suggested_date": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"duration_minutes"?: number | null,"id"?: string,"kind": string,"plan_id": string,"related_entry_ids"?: (string)[],"remind_at"?: string | null,"suggested_date"?: string | null,"title": string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"duration_minutes"?: number | null,"id"?: string,"kind"?: string,"plan_id"?: string,"related_entry_ids"?: (string)[],"remind_at"?: string | null,"suggested_date"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prep_tasks_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prep_tasks_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"id": string,"locale": string,"personal_group_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"locale"?: string,"personal_group_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"locale"?: string,"personal_group_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_personal_group_id_fkey"
      columns: ["personal_group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_favorites": {
                  Row: {
                    "created_at": string,"recipe_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"recipe_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"recipe_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_favorites_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_ingredients": {
                  Row: {
                    "id": string,"ingredient_id": string | null,"optional": boolean,"position": number,"preparation": string | null,"quantity": number | null,"raw_text": string | null,"recipe_id": string,"section": string | null,"unit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"ingredient_id"?: string | null,"optional"?: boolean,"position"?: number,"preparation"?: string | null,"quantity"?: number | null,"raw_text"?: string | null,"recipe_id": string,"section"?: string | null,"unit"?: string | null
                  }
                  Update: {
                    "id"?: string,"ingredient_id"?: string | null,"optional"?: boolean,"position"?: number,"preparation"?: string | null,"quantity"?: number | null,"raw_text"?: string | null,"recipe_id"?: string,"section"?: string | null,"unit"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_share_links": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"recipe_id": string,"revoked_at": string | null,"token": string,"view_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"recipe_id": string,"revoked_at"?: string | null,"token": string,"view_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"recipe_id"?: string,"revoked_at"?: string | null,"token"?: string,"view_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_share_links_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_share_links_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_steps": {
                  Row: {
                    "duration_seconds": number | null,"id": string,"image_url": string | null,"ingredient_ids": (string)[] | null,"instruction": string,"position": number,"recipe_id": string,"timer_kind": string | null,"tip": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_seconds"?: number | null,"id"?: string,"image_url"?: string | null,"ingredient_ids"?: (string)[] | null,"instruction": string,"position"?: number,"recipe_id": string,"timer_kind"?: string | null,"tip"?: string | null
                  }
                  Update: {
                    "duration_seconds"?: number | null,"id"?: string,"image_url"?: string | null,"ingredient_ids"?: (string)[] | null,"instruction"?: string,"position"?: number,"recipe_id"?: string,"timer_kind"?: string | null,"tip"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_steps_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_versions": {
                  Row: {
                    "change_note": string | null,"changed_by": string | null,"created_at": string,"id": string,"origin": string,"recipe_id": string,"snapshot": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "change_note"?: string | null,"changed_by"?: string | null,"created_at"?: string,"id"?: string,"origin": string,"recipe_id": string,"snapshot": NonNullable<Json>,"version": number
                  }
                  Update: {
                    "change_note"?: string | null,"changed_by"?: string | null,"created_at"?: string,"id"?: string,"origin"?: string,"recipe_id"?: string,"snapshot"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_versions_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_versions_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "cook_minutes": number | null,"created_at": string,"created_by": string | null,"current_version": number,"deleted_at": string | null,"description": string | null,"difficulty": string | null,"draft_for_plan_id": string | null,"forked_from_group_name": string | null,"forked_from_recipe_id": string | null,"forked_from_title": string | null,"forked_from_version": number | null,"group_id": string,"id": string,"image_url": string | null,"prep_minutes": number | null,"search_tsv": unknown,"servings": number,"source_type": string,"source_url": string | null,"status": string,"storage_info": Json | null,"tags": (string)[],"title": string,"total_minutes": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cook_minutes"?: number | null,"created_at"?: string,"created_by"?: string | null,"current_version"?: number,"deleted_at"?: string | null,"description"?: string | null,"difficulty"?: string | null,"draft_for_plan_id"?: string | null,"forked_from_group_name"?: string | null,"forked_from_recipe_id"?: string | null,"forked_from_title"?: string | null,"forked_from_version"?: number | null,"group_id": string,"id"?: string,"image_url"?: string | null,"prep_minutes"?: number | null,"search_tsv"?: unknown,"servings"?: number,"source_type"?: string,"source_url"?: string | null,"status"?: string,"storage_info"?: Json | null,"tags"?: (string)[],"title": string,"total_minutes"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "cook_minutes"?: number | null,"created_at"?: string,"created_by"?: string | null,"current_version"?: number,"deleted_at"?: string | null,"description"?: string | null,"difficulty"?: string | null,"draft_for_plan_id"?: string | null,"forked_from_group_name"?: string | null,"forked_from_recipe_id"?: string | null,"forked_from_title"?: string | null,"forked_from_version"?: number | null,"group_id"?: string,"id"?: string,"image_url"?: string | null,"prep_minutes"?: number | null,"search_tsv"?: unknown,"servings"?: number,"source_type"?: string,"source_url"?: string | null,"status"?: string,"storage_info"?: Json | null,"tags"?: (string)[],"title"?: string,"total_minutes"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_draft_for_plan_id_fkey"
      columns: ["draft_for_plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_forked_from_recipe_id_fkey"
      columns: ["forked_from_recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_list_items": {
                  Row: {
                    "aisle": string,"created_at": string,"display_name": string,"id": string,"ingredient_id": string | null,"is_manual": boolean,"list_id": string,"needed_by": string | null,"no_longer_needed": boolean,"note": string | null,"pantry_staple": boolean,"position": number,"purchase_hint": string | null,"quantity": number | null,"shelf_life_warning": string | null,"source_entry_ids": (string)[],"state": string,"state_at": string | null,"state_by": string | null,"unit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle"?: string,"created_at"?: string,"display_name": string,"id"?: string,"ingredient_id"?: string | null,"is_manual"?: boolean,"list_id": string,"needed_by"?: string | null,"no_longer_needed"?: boolean,"note"?: string | null,"pantry_staple"?: boolean,"position"?: number,"purchase_hint"?: string | null,"quantity"?: number | null,"shelf_life_warning"?: string | null,"source_entry_ids"?: (string)[],"state"?: string,"state_at"?: string | null,"state_by"?: string | null,"unit"?: string | null
                  }
                  Update: {
                    "aisle"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"ingredient_id"?: string | null,"is_manual"?: boolean,"list_id"?: string,"needed_by"?: string | null,"no_longer_needed"?: boolean,"note"?: string | null,"pantry_staple"?: boolean,"position"?: number,"purchase_hint"?: string | null,"quantity"?: number | null,"shelf_life_warning"?: string | null,"source_entry_ids"?: (string)[],"state"?: string,"state_at"?: string | null,"state_by"?: string | null,"unit"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_list_items_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_list_items_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "shopping_lists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_list_items_state_by_fkey"
      columns: ["state_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_lists": {
                  Row: {
                    "created_at": string,"created_by": string | null,"group_id": string,"id": string,"name": string,"plan_id": string | null,"shop_date": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"group_id": string,"id"?: string,"name": string,"plan_id"?: string | null,"shop_date"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"group_id"?: string,"id"?: string,"name"?: string,"plan_id"?: string | null,"shop_date"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_lists_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_lists_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_lists_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_fork_recipe_core":
{ Args: { "p_source_id": string,"p_target_group_id": string }; Returns: string
                           },
"accept_inbox_recipe":
{ Args: { "p_inbox_id": string,"p_target_group_id": string }; Returns: string
                           },
"accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"approve_plan":
{ Args: { "p_plan_id": string }; Returns: undefined
                           },
"consume_ai_quota":
{ Args: { "p_feature": string,"p_limit": number,"p_user_id": string }; Returns: boolean
                           },
"create_group":
{ Args: { "p_emoji": string,"p_name": string }; Returns: string
                           },
"create_share_link":
{ Args: { "p_recipe_id": string }; Returns: string
                           },
"duplicate_plan":
{ Args: { "p_plan_id": string,"p_week_start": string }; Returns: string
                           },
"fork_public_recipe":
{ Args: { "p_target_group_id": string,"p_token": string }; Returns: string
                           },
"fork_recipe":
{ Args: { "p_source_recipe_id": string,"p_target_group_id": string }; Returns: string
                           },
"get_group_diet":
{ Args: { "p_group_id": string }; Returns: {
              "display_name": string,"goals": Json,"restrictions": Json,"user_id": string
            }[]
                           },
"get_invite_preview":
{ Args: { "p_token": string }; Returns: {
              "group_emoji": string,"group_id": string,"group_name": string,"inviter_name": string,"is_expired": boolean,"is_revoked": boolean,"is_valid": boolean,"member_count": number
            }[]
                           },
"get_public_recipe":
{ Args: { "p_token": string }; Returns: Json
                           },
"group_role":
{ Args: { "gid": string }; Returns: string
                           },
"is_group_member":
{ Args: { "gid": string }; Returns: boolean
                           },
"is_recipe_member":
{ Args: { "p_recipe_id": string }; Returns: boolean
                           },
"is_storage_group_member":
{ Args: { "p_path": string }; Returns: boolean
                           },
"leave_group":
{ Args: { "gid": string }; Returns: undefined
                           },
"list_group_id":
{ Args: { "p_list_id": string }; Returns: string
                           },
"plan_group_id":
{ Args: { "p_plan_id": string }; Returns: string
                           },
"recipe_last_cooked":
{ Args: { "p_recipe_id": string }; Returns: {
              "cooked_by": string,"finished_at": string,"rating": number
            }[]
                           },
"recipes_search_tsv":
{ Args: { "p_recipe_id": string }; Returns: unknown
                           },
"remove_member":
{ Args: { "gid": string,"p_user_id": string }; Returns: undefined
                           },
"revoke_share_link":
{ Args: { "p_recipe_id": string }; Returns: undefined
                           },
"save_recipe":
{ Args: { "p_recipe": Json }; Returns: Json
                           },
"search_ingredients":
{ Args: { "lim"?: number,"q": string }; Returns: {
              "aliases": (string)[],"id": string,"name": string,"similarity": number
            }[]
                           },
"send_recipe_to_user":
{ Args: { "p_recipe_id": string,"p_user_id": string }; Returns: string
                           },
"set_item_state":
{ Args: { "p_item_id": string,"p_state": string }; Returns: {
              "aisle": string,
"created_at": string,
"display_name": string,
"id": string,
"ingredient_id": string | null,
"is_manual": boolean,
"list_id": string,
"needed_by": string | null,
"no_longer_needed": boolean,
"note": string | null,
"pantry_staple": boolean,
"position": number,
"purchase_hint": string | null,
"quantity": number | null,
"shelf_life_warning": string | null,
"source_entry_ids": (string)[],
"state": string,
"state_at": string | null,
"state_by": string | null,
"unit": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "shopping_list_items"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_member_role":
{ Args: { "gid": string,"p_role": string,"p_user_id": string }; Returns: undefined
                           },
"shares_group_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
