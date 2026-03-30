import DashboardHomeView from '@/features/dashboard/home/views/DashboardHomeView.vue'
import ProductsView from '@/features/POS/products/views/ProductsView.vue'
import OrdersView from '@/features/POS/orders/views/OrdersView.vue'
import LoginView from '@/features/auth/login/views/LoginView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { layout: 'auth' },
    },
    {
      path: '/',
      name: 'home',
      component: DashboardHomeView,
      meta: { layout: 'dashboard' },
    },
    {
      path: '/pos/products',
      name: 'pos-products',
      component: ProductsView,
      meta: { layout: 'dashboard' },
    },
    {
      path: '/pos/orders',
      name: 'pos-orders',
      component: OrdersView,
      meta: { layout: 'dashboard' },
    },
  ],
})

export default router
