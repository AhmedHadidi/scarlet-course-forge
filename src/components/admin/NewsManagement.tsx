import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { NewsCategoryManagement } from "./NewsCategoryManagement";
import { NewsArticleManagement } from "./NewsArticleManagement";
import { NewsBulletinManagement } from "./NewsBulletinManagement";
import { Tag, Newspaper, FileStack } from "lucide-react";

export const NewsManagement = () => {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-6">
        <Tabs defaultValue="articles" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="articles" className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="bulletins" className="flex items-center gap-2">
              <FileStack className="h-4 w-4" />
              Bulletins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="articles">
            <NewsArticleManagement />
          </TabsContent>

          <TabsContent value="categories">
            <NewsCategoryManagement />
          </TabsContent>

          <TabsContent value="bulletins">
            <NewsBulletinManagement />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
