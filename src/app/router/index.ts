import DashboardHomeView from '@/features/dashboard/home/views/DashboardHomeView.vue'
import ProductsView from '@/features/POS/products/views/ProductsView.vue'
import OrdersView from '@/features/POS/orders/views/OrdersView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: DashboardHomeView,
    },
    {
      path: '/pos/products',
      name: 'pos-products',
      component: ProductsView,
    },
    {
      path: '/pos/orders',
      name: 'pos-orders',
      component: OrdersView,
    },
  ],
})

export default router
