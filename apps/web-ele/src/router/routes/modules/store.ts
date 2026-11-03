import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: { icon: 'lucide:store', order: 1, title: '门店管理' },
    name: 'Store',
    path: '/store',
    children: [
      {
        name: 'StoreCategory',
        path: 'category',
        component: () => import('#/views/store/category/index.vue'),
        meta: { icon: 'lucide:shapes', title: '手工品类' },
      },
      {
        name: 'StoreCustomer',
        path: 'customer',
        component: () => import('#/views/store/customer/index.vue'),
        meta: { icon: 'lucide:users', title: '客户管理' },
      },
      {
        name: 'StoreRecharge',
        path: 'recharge',
        component: () => import('#/views/store/recharge/index.vue'),
        meta: { icon: 'lucide:wallet', title: '充值管理' },
      },
      {
        name: 'StoreConsumption',
        path: 'consumption',
        component: () => import('#/views/store/consumption/index.vue'),
        meta: { icon: 'lucide:shopping-cart', title: '消费管理' },
      },
      {
        name: 'StoreAccount',
        path: 'account',
        component: () => import('#/views/store/account/index.vue'),
        meta: { icon: 'lucide:coins', title: '客户余额' },
      },
    ],
  },
];

export default routes;
