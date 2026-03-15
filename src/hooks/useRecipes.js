import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  loadRecipesFromSupabase,
  saveRecipeToSupabase,
  deleteRecipeFromSupabase,
} from "../services/supabase";

export function useRecipes(userId) {
  const queryClient = useQueryClient();
  const queryKey = ["recipes", userId];

  const { data: recipes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => loadRecipesFromSupabase(userId),
    enabled: !!userId,
  });

  const { mutateAsync: saveRecipe } = useMutation({
    mutationFn: (recipe) => saveRecipeToSupabase(recipe, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const { mutate: deleteRecipe } = useMutation({
    mutationFn: (id) => deleteRecipeFromSupabase(id),
    // Optimistic update: remove from cache immediately
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old = []) => old.filter(r => r.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(queryKey, context.previous);
    },
  });

  // Add newly digitized recipes to the cache without a refetch
  const addRecipes = (newRecipes) => {
    queryClient.setQueryData(queryKey, (old = []) => [...newRecipes, ...old]);
  };

  return { recipes, isLoading, saveRecipe, deleteRecipe, addRecipes };
}
