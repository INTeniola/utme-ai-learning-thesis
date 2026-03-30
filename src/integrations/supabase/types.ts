export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_interactions: {
        Row: {
          content: string
          context: Json | null
          conversation_id: string | null
          created_at: string | null
          id: string
          message_type: string
          metadata: Json | null
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          context?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message_type: string
          metadata?: Json | null
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          context?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          id: string
          user_id: string
          feature_type: string
          tokens_estimated: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          feature_type: string
          tokens_estimated?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          feature_type?: string
          tokens_estimated?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          subject: string
          title: string | null
          message_count: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          title?: string | null
          message_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          title?: string | null
          message_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      concept_mastery: {
        Row: {
          accuracy: number
          created_at: string
          id: string
          last_quiz_at: string | null
          subject: string
          topic: string
          total_attempts: number
          total_correct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number
          created_at?: string
          id?: string
          last_quiz_at?: string | null
          subject: string
          topic: string
          total_attempts?: number
          total_correct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number
          created_at?: string
          id?: string
          last_quiz_at?: string | null
          subject?: string
          topic?: string
          total_attempts?: number
          total_correct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_logs: {
        Row: {
          confidence_level: number | null
          correct_answer: string | null
          created_at: string
          exam_session_id: string
          hints_used: number | null
          id: string
          interaction_data: Json
          is_correct: boolean | null
          question_index: number
          selected_answer: string | null
          subject: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          confidence_level?: number | null
          correct_answer?: string | null
          created_at?: string
          exam_session_id: string
          hints_used?: number | null
          id?: string
          interaction_data?: Json
          is_correct?: boolean | null
          question_index: number
          selected_answer?: string | null
          subject: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          confidence_level?: number | null
          correct_answer?: string | null
          created_at?: string
          exam_session_id?: string
          hints_used?: number | null
          id?: string
          interaction_data?: Json
          is_correct?: boolean | null
          question_index?: number
          selected_answer?: string | null
          subject?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: []
      }
      exam_sessions: {
        Row: {
          answers: Json | null
          completed_at: string | null
          created_at: string
          current_question_index: number | null
          diagnostic_data: Json | null
          id: string
          question_order: string[] | null
          score: number | null
          started_at: string
          status: string
          subjects: string[]
          time_limit_minutes: number
          time_spent_per_question: Json | null
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          current_question_index?: number | null
          diagnostic_data?: Json | null
          id?: string
          question_order?: string[] | null
          score?: number | null
          started_at?: string
          status?: string
          subjects: string[]
          time_limit_minutes?: number
          time_spent_per_question?: Json | null
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          current_question_index?: number | null
          diagnostic_data?: Json | null
          id?: string
          question_order?: string[] | null
          score?: number | null
          started_at?: string
          status?: string
          subjects?: string[]
          time_limit_minutes?: number
          time_spent_per_question?: Json | null
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_reviews: {
        Row: {
          flashcard_id: string
          id: string
          rating: number
          reviewed_at: string
          time_to_recall_ms: number | null
          user_id: string
        }
        Insert: {
          flashcard_id: string
          id?: string
          rating: number
          reviewed_at?: string
          time_to_recall_ms?: number | null
          user_id: string
        }
        Update: {
          flashcard_id?: string
          id?: string
          rating?: number
          reviewed_at?: string
          time_to_recall_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back_text: string
          created_at: string
          easiness_factor: number
          front_text: string
          id: string
          interval_days: number
          last_reviewed_at: string | null
          next_review_date: string
          repetitions: number
          source: string | null
          source_question_id: string | null
          source_reference: string | null
          subject: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          back_text: string
          created_at?: string
          easiness_factor?: number
          front_text: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          next_review_date?: string
          repetitions?: number
          source?: string | null
          source_question_id?: string | null
          source_reference?: string | null
          subject: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          back_text?: string
          created_at?: string
          easiness_factor?: number
          front_text?: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          next_review_date?: string
          repetitions?: number
          source?: string | null
          source_question_id?: string | null
          source_reference?: string | null
          subject?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jamb_syllabus: {
        Row: {
          created_at: string | null
          id: string
          objectives: string[] | null
          recommended_resources: string[] | null
          subject: string
          subtopics: Json | null
          syllabus_code: string | null
          topic: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          objectives?: string[] | null
          recommended_resources?: string[] | null
          subject: string
          subtopics?: Json | null
          syllabus_code?: string | null
          topic: string
        }
        Update: {
          created_at?: string | null
          id?: string
          objectives?: string[] | null
          recommended_resources?: string[] | null
          subject?: string
          subtopics?: Json | null
          syllabus_code?: string | null
          topic?: string
        }
        Relationships: []
      }
      knowledge_graph: {
        Row: {
          content_chunk: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          source_year: number | null
          subject: string
          subtopic: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          content_chunk: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_year?: number | null
          subject: string
          subtopic?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          content_chunk?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_year?: number | null
          subject?: string
          subtopic?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      past_questions: {
        Row: {
          correct_option: string
          created_at: string
          difficulty: string | null
          explanation: string | null
          id: string
          metadata: Json | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          subject: string
          subtopic: string | null
          topic: string
          year: number
        }
        Insert: {
          correct_option: string
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          metadata?: Json | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          subject: string
          subtopic?: string | null
          topic: string
          year: number
        }
        Update: {
          correct_option?: string
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          metadata?: Json | null
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question_text?: string
          subject?: string
          subtopic?: string | null
          topic?: string
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          academic_goals: Json | null
          active_session_id: string | null
          avatar_url: string | null
          created_at: string
          current_streak: number | null
          daily_ai_quota: number | null
          full_name: string | null
          id: string
          is_premium: boolean | null
          last_activity_date: string | null
          subjects_meta: Json | null
          total_study_minutes: number | null
          updated_at: string
          username: string | null
          utme_exam_date: string | null
          xp_points: number | null
        }
        Insert: {
          academic_goals?: Json | null
          active_session_id?: string | null
          avatar_url?: string | null
          created_at?: string
          current_streak?: number | null
          daily_ai_quota?: number | null
          full_name?: string | null
          id: string
          is_premium?: boolean | null
          last_activity_date?: string | null
          subjects_meta?: Json | null
          total_study_minutes?: number | null
          updated_at?: string
          username?: string | null
          utme_exam_date?: string | null
          xp_points?: number | null
        }
        Update: {
          academic_goals?: Json | null
          active_session_id?: string | null
          avatar_url?: string | null
          created_at?: string
          current_streak?: number | null
          daily_ai_quota?: number | null
          full_name?: string | null
          id?: string
          is_premium?: boolean | null
          last_activity_date?: string | null
          subjects_meta?: Json | null
          total_study_minutes?: number | null
          updated_at?: string
          username?: string | null
          utme_exam_date?: string | null
          xp_points?: number | null
        }
        Relationships: []
      }
      quiz_results: {
        Row: {
          answers: Json | null
          completed_at: string
          flagged_questions: string[] | null
          hints_used: number
          id: string
          quiz_id: string
          score: number
          time_taken_seconds: number
          topic_breakdown: Json | null
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string
          flagged_questions?: string[] | null
          hints_used?: number
          id?: string
          quiz_id: string
          score?: number
          time_taken_seconds?: number
          topic_breakdown?: Json | null
          total_questions: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string
          flagged_questions?: string[] | null
          hints_used?: number
          id?: string
          quiz_id?: string
          score?: number
          time_taken_seconds?: number
          topic_breakdown?: Json | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          ai_generated_questions: Json | null
          created_at: string
          difficulty_mode: string
          focus_weak_topics: boolean
          id: string
          question_count: number
          question_ids: string[] | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generated_questions?: Json | null
          created_at?: string
          difficulty_mode?: string
          focus_weak_topics?: boolean
          id?: string
          question_count?: number
          question_ids?: string[] | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generated_questions?: Json | null
          created_at?: string
          difficulty_mode?: string
          focus_weak_topics?: boolean
          id?: string
          question_count?: number
          question_ids?: string[] | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          duration_minutes: number
          ended_at: string | null
          flashcards_reviewed: number | null
          id: string
          metadata: Json | null
          questions_answered: number | null
          session_type: string
          started_at: string
          subject: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          flashcards_reviewed?: number | null
          id?: string
          metadata?: Json | null
          questions_answered?: number | null
          session_type?: string
          started_at?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          flashcards_reviewed?: number | null
          id?: string
          metadata?: Json | null
          questions_answered?: number | null
          session_type?: string
          started_at?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      uploaded_content: {
        Row: {
          cleaned_markdown: string | null
          concepts: Json | null
          created_at: string | null
          detected_subject: string | null
          detected_topic: string | null
          extracted_formulas: string[] | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string | null
          generated_questions: Json | null
          id: string
          knowledge_summary: string | null
          processing_error: string | null
          processing_status: string | null
          raw_text: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cleaned_markdown?: string | null
          concepts?: Json | null
          created_at?: string | null
          detected_subject?: string | null
          detected_topic?: string | null
          extracted_formulas?: string[] | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url?: string | null
          generated_questions?: Json | null
          id?: string
          knowledge_summary?: string | null
          processing_error?: string | null
          processing_status?: string | null
          raw_text?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cleaned_markdown?: string | null
          concepts?: Json | null
          created_at?: string | null
          detected_subject?: string | null
          detected_topic?: string | null
          extracted_formulas?: string[] | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string | null
          generated_questions?: Json | null
          id?: string
          knowledge_summary?: string | null
          processing_error?: string | null
          processing_status?: string | null
          raw_text?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          created_at: string
          earned_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_mastery_ledger: {
        Row: {
          attempts_count: number | null
          created_at: string
          error_patterns: Json | null
          id: string
          last_practiced_at: string | null
          mastery_score: number | null
          subject: string
          subtopic: string | null
          topic: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts_count?: number | null
          created_at?: string
          error_patterns?: Json | null
          id?: string
          last_practiced_at?: string | null
          mastery_score?: number | null
          subject: string
          subtopic?: string | null
          topic: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts_count?: number | null
          created_at?: string
          error_patterns?: Json | null
          id?: string
          last_practiced_at?: string | null
          mastery_score?: number | null
          subject?: string
          subtopic?: string | null
          topic?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mastery_ledger_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graph"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      past_questions_public: {
        Row: {
          created_at: string | null
          difficulty: string | null
          id: string | null
          metadata: Json | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          question_text: string | null
          subject: string | null
          subtopic: string | null
          topic: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          difficulty?: string | null
          id?: string | null
          metadata?: Json | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_text?: string | null
          subject?: string | null
          subtopic?: string | null
          topic?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          difficulty?: string | null
          id?: string | null
          metadata?: Json | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_text?: string | null
          subject?: string | null
          subtopic?: string | null
          topic?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_dashboard_data: { Args: { p_user_id: string }; Returns: Json }
      get_daily_usage_count: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
